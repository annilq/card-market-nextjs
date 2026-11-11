'use client'

import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import { BatchFileList } from './BatchFileList'
import {
  batchReducer,
  createCardDraft,
  defaultAltFromFilename,
  isItemDirty,
  savedCardId,
  type BatchItem,
  type BatchState,
  type BulkCardsTaxonomy,
  type CardDraft,
} from './batch-state'
import { BulkApplyPanel, type BulkApplyChanges } from './BulkApplyPanel'
import { CardDraftForm } from './CardDraftForm'
import { CardSaveError, saveCard } from './cards-api'
import { MediaUploadError, uploadMedia } from './media-uploader'

import '../admin-ui.css'

export type { BulkCardsTaxonomy, TaxonomyOption } from './batch-state'

export type BulkCardsClientProps = {
  adminRoute: string
  apiRoute: string
  taxonomy: BulkCardsTaxonomy
}

const MAX_CONCURRENT_UPLOADS = 3

const initialState: BatchState = { items: [], selectedId: null }

function nextUnsavedReady(items: BatchItem[], currentId: string): BatchItem | null {
  const index = items.findIndex((item) => item.id === currentId)
  if (index === -1) return null
  const ordered = [...items.slice(index + 1), ...items.slice(0, index)]
  return (
    ordered.find((item) => item.upload.kind === 'ready' && savedCardId(item.save) == null) ?? null
  )
}

function hasEnteredDetails(draft: CardDraft): boolean {
  return Boolean(
    draft.name.trim() ||
      draft.code.trim() ||
      draft.price.trim() ||
      draft.description.trim(),
  )
}

export function BulkCardsClient({ apiRoute, taxonomy }: BulkCardsClientProps) {
  const [state, dispatch] = useReducer(batchReducer, initialState)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef<Set<string>>(new Set())
  const controllersRef = useRef<Map<string, AbortController>>(new Map())
  const previewUrlsRef = useRef<Set<string>>(new Set())

  const addFiles = useCallback((files: FileList | File[]) => {
    const items: BatchItem[] = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => {
        const previewUrl = URL.createObjectURL(file)
        previewUrlsRef.current.add(previewUrl)
        return {
          id: crypto.randomUUID(),
          file,
          previewUrl,
          draft: createCardDraft(defaultAltFromFilename(file.name)),
          upload: { kind: 'queued' },
          save: { kind: 'idle' },
          savedSnapshot: null,
        } satisfies BatchItem
      })

    if (items.length === 0) return
    setError(null)
    dispatch({ type: 'files/add', items })
  }, [])

  const startUpload = useCallback(
    async (item: BatchItem) => {
      startedRef.current.add(item.id)
      const controller = new AbortController()
      controllersRef.current.set(item.id, controller)

      try {
        const media = await uploadMedia(item.file, {
          alt: item.draft.alt,
          apiRoute,
          signal: controller.signal,
          onPhase: (phase) =>
            dispatch({ type: 'upload/phase', id: item.id, phase, total: item.file.size }),
          onProgress: (sent, total) =>
            dispatch({ type: 'upload/progress', id: item.id, sent, total }),
        })
        dispatch({ type: 'upload/ready', id: item.id, media })
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        dispatch({
          type: 'upload/failed',
          id: item.id,
          phase: caught instanceof MediaUploadError ? caught.phase : 'upload',
          message: caught instanceof Error ? caught.message : '上传失败',
        })
      } finally {
        startedRef.current.delete(item.id)
        controllersRef.current.delete(item.id)
      }
    },
    [apiRoute],
  )

  useEffect(() => {
    const capacity = MAX_CONCURRENT_UPLOADS - startedRef.current.size
    if (capacity <= 0) return
    const queued = state.items.filter(
      (item) => item.upload.kind === 'queued' && !startedRef.current.has(item.id),
    )
    for (const item of queued.slice(0, capacity)) {
      void startUpload(item)
    }
  }, [state.items, startUpload])

  useEffect(() => {
    const controllers = controllersRef.current
    const previewUrls = previewUrlsRef.current
    return () => {
      controllers.forEach((controller) => controller.abort())
      controllers.clear()
      previewUrls.forEach((url) => URL.revokeObjectURL(url))
      previewUrls.clear()
    }
  }, [])

  const selectItem = useCallback((id: string) => {
    dispatch({ type: 'item/select', id })
  }, [])

  const removeItem = useCallback(
    async (id: string) => {
      const item = state.items.find((candidate) => candidate.id === id)
      if (!item) return

      if (
        savedCardId(item.save) == null &&
        hasEnteredDetails(item.draft) &&
        !window.confirm('这张图片填写的信息尚未保存，确定移除？')
      ) {
        return
      }

      if (item.upload.kind === 'ready') {
        try {
          const response = await fetch(`${apiRoute}/media/${item.upload.media.id}`, {
            method: 'DELETE',
            credentials: 'include',
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
        } catch {
          setError('删除素材失败，请稍后重试')
          return
        }
      } else {
        controllersRef.current.get(id)?.abort()
        controllersRef.current.delete(id)
        startedRef.current.delete(id)
      }

      URL.revokeObjectURL(item.previewUrl)
      previewUrlsRef.current.delete(item.previewUrl)
      setError(null)
      dispatch({ type: 'item/remove', id })
    },
    [apiRoute, state.items],
  )

  const retryUpload = useCallback((id: string) => {
    startedRef.current.delete(id)
    setError(null)
    dispatch({ type: 'upload/retry', id })
  }, [])

  const changeDraft = useCallback((id: string, changes: Partial<CardDraft>) => {
    dispatch({ type: 'draft/change', id, changes })
  }, [])

  const saveItem = useCallback(
    async (id: string) => {
      const item = state.items.find((candidate) => candidate.id === id)
      if (!item || item.upload.kind !== 'ready') return
      if (item.save.kind === 'saving' || item.save.kind === 'updating') return

      const existingCardId = savedCardId(item.save) ?? undefined
      dispatch({ type: 'save/start', id })
      try {
        const cardId = await saveCard({
          apiRoute,
          draft: item.draft,
          media: item.upload.media,
          existingCardId,
        })
        dispatch({ type: 'save/succeeded', id, cardId })
        // 更新已存在的卡牌不跳走，方便连续修改；新建才自动切到下一张待填图片。
        if (existingCardId == null) {
          const next = nextUnsavedReady(state.items, id)
          if (next) dispatch({ type: 'item/select', id: next.id })
        }
      } catch (caught) {
        dispatch({
          type: 'save/failed',
          id,
          message: caught instanceof CardSaveError ? caught.message : '保存卡牌失败',
          field: caught instanceof CardSaveError ? caught.field : 'card',
        })
      }
    },
    [apiRoute, state.items],
  )

  const applyBulkChanges = useCallback(
    (changes: BulkApplyChanges): number => {
      const targets = state.items.filter(
        (item) =>
          savedCardId(item.save) == null &&
          item.save.kind !== 'saving' &&
          item.save.kind !== 'updating',
      )
      if (targets.length > 0) dispatch({ type: 'draft/bulk-change', changes })
      return targets.length
    },
    [state.items],
  )

  const selectRelative = useCallback(
    (delta: number) => {
      const index = state.items.findIndex((item) => item.id === state.selectedId)
      if (index === -1) return
      const target = state.items[index + delta]
      if (target) dispatch({ type: 'item/select', id: target.id })
    },
    [state.items, state.selectedId],
  )

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent): void => {
      if (!state.items.some(isItemDirty)) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [state.items])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable === true
      if (typing) return
      event.preventDefault()
      selectRelative(event.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectRelative])

  const selected = state.items.find((item) => item.id === state.selectedId) ?? null
  const selectedIndex = state.items.findIndex((item) => item.id === state.selectedId)
  const selectedPreviewUrl = selected
    ? selected.upload.kind === 'ready'
      ? selected.upload.media.url || selected.previewUrl
      : selected.previewUrl
    : null

  return (
    <div
      className="flex h-[calc(100vh-100px)] min-h-[520px] flex-col gap-4 lg:flex-row"
      data-admin-ui=""
    >
      <aside
        aria-label="待处理图片"
        className="flex min-h-[320px] flex-col overflow-hidden rounded-lg border border-border bg-card lg:min-h-0 lg:w-[360px] lg:shrink-0"
      >
        <BatchFileList
          items={state.items}
          onAddFiles={addFiles}
          onRemove={removeItem}
          onRetry={retryUpload}
          onSelect={selectItem}
          selectedId={state.selectedId}
        />
      </aside>

      <section
        aria-label="卡牌信息"
        className="flex min-h-[320px] flex-1 flex-col gap-4 overflow-y-auto rounded-lg border border-dashed border-border bg-card p-5 lg:min-h-0"
      >
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {selected ? (
          <>
            <div className="flex flex-wrap items-start gap-4">
              {/* 媒体经过 302 跳到 B2，next/image 无法优化，必须用原生 img。 */}
              <img
                alt={selected.draft.alt || selected.file.name}
                className="max-h-[260px] max-w-full rounded-md border border-border bg-secondary object-contain"
                src={selectedPreviewUrl ?? undefined}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="break-all text-sm font-medium" title={selected.file.name}>
                    {selected.file.name}
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      className="rounded-sm border border-border px-2 py-1 text-xs hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={selectedIndex <= 0}
                      onClick={() => selectRelative(-1)}
                      type="button"
                    >
                      上一张
                    </button>
                    <span className="tabular px-1 text-xs text-muted-foreground">
                      {selectedIndex + 1} / {state.items.length}
                    </span>
                    <button
                      className="rounded-sm border border-border px-2 py-1 text-xs hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={selectedIndex >= state.items.length - 1}
                      onClick={() => selectRelative(1)}
                      type="button"
                    >
                      下一张
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selected.upload.kind === 'ready'
                    ? selected.upload.media.width > 0 && selected.upload.media.height > 0
                      ? `${selected.upload.media.width} × ${selected.upload.media.height}`
                      : '图片已上传'
                    : '上传完成后自动填入图片尺寸'}
                </p>
              </div>
            </div>

            <BulkApplyPanel onApply={applyBulkChanges} taxonomy={taxonomy} />

            <CardDraftForm
              item={selected}
              key={selected.id}
              onChange={(changes) => changeDraft(selected.id, changes)}
              onSave={() => void saveItem(selected.id)}
              taxonomy={taxonomy}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">选择左侧图片后填写卡牌信息</p>
          </div>
        )}
      </section>
    </div>
  )
}

export default BulkCardsClient
