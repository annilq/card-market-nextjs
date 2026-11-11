'use client'

import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import { BatchFileList } from './BatchFileList'
import {
  batchReducer,
  createCardDraft,
  defaultAltFromFilename,
  type BatchItem,
  type BatchState,
} from './batch-state'
import { MediaUploadError, uploadMedia } from './media-uploader'

import '../admin-ui.css'

export type TaxonomyOption = { id: number; name: string }

export type BulkCardsTaxonomy = {
  ips: TaxonomyOption[]
  series: (TaxonomyOption & { ipId: number })[]
  subSeries: (TaxonomyOption & { seriesId: number })[]
  rarities: TaxonomyOption[]
  cardStatuses: TaxonomyOption[]
}

export type BulkCardsClientProps = {
  adminRoute: string
  apiRoute: string
  taxonomy: BulkCardsTaxonomy
}

const MAX_CONCURRENT_UPLOADS = 3

const initialState: BatchState = { items: [], selectedId: null }

export function BulkCardsClient({ apiRoute }: BulkCardsClientProps) {
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

  const selected = state.items.find((item) => item.id === state.selectedId) ?? null
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
            {/* 媒体经过 302 跳到 B2，next/image 无法优化，必须用原生 img。 */}
            <img
              alt={selected.draft.alt || selected.file.name}
              className="max-h-[420px] max-w-full self-start rounded-md border border-border bg-secondary object-contain"
              src={selectedPreviewUrl ?? undefined}
            />
            <p className="break-all text-sm font-medium" title={selected.file.name}>
              {selected.file.name}
            </p>
            <label className="flex max-w-[420px] flex-col gap-1.5">
              <span className="text-sm font-medium">替代文本</span>
              <input
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) =>
                  dispatch({
                    type: 'draft/change',
                    id: selected.id,
                    changes: { alt: event.target.value },
                  })
                }
                type="text"
                value={selected.draft.alt}
              />
            </label>
            <p className="text-xs text-muted-foreground">卡牌信息表单将在下一阶段接入</p>
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
