'use client'

import { Check, Loader2, Plus, RotateCcw, Upload, X } from 'lucide-react'
import React, { useRef, useState } from 'react'

import { isItemDirty, savedCardId, type BatchItem, type UploadState } from './batch-state'

export type BatchFileListProps = {
  items: BatchItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onAddFiles: (files: File[]) => void
}

function formatSize(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function progressPercent(upload: Extract<UploadState, { kind: 'uploading' }>): number {
  if (upload.total <= 0) return 0
  return Math.min(100, Math.round((upload.sent / upload.total) * 100))
}

type StatusTone = 'saved' | 'pending' | 'dirty' | 'busy' | 'queued' | 'failed'

type ItemStatus = {
  label: string
  tone: StatusTone
  spinning?: boolean
}

/** 每条图片只有一种「现在该做什么」的状态；列表里用同一枚胶囊表达。 */
function itemStatus(item: BatchItem): ItemStatus {
  const cardId = savedCardId(item.save)
  if (item.save.kind === 'updating') return { label: '更新中', tone: 'busy', spinning: true }
  if (item.save.kind === 'saving') return { label: '保存中', tone: 'busy', spinning: true }
  if (item.save.kind === 'failed' && cardId != null) return { label: '更新失败', tone: 'failed' }
  if (cardId != null) {
    return isItemDirty(item)
      ? { label: '有修改', tone: 'dirty' }
      : { label: '已保存', tone: 'saved' }
  }
  if (item.save.kind === 'failed') return { label: '保存失败', tone: 'failed' }

  switch (item.upload.kind) {
    case 'queued':
    case 'requesting':
      return { label: '排队中', tone: 'queued' }
    case 'uploading':
      return { label: `上传 ${progressPercent(item.upload)}%`, tone: 'busy', spinning: true }
    case 'processing':
      return { label: '处理中', tone: 'busy', spinning: true }
    case 'ready':
      return { label: '未填写', tone: 'pending' }
    case 'failed':
      return { label: '上传失败', tone: 'failed' }
  }
}

/* 已保存用绿色、未填写用琥珀色：这两个状态占了列表里的绝大多数行，
   必须一眼扫得出来。其余状态保持中性或沿用品牌红。 */
const TONE_CLASS: Record<StatusTone, string> = {
  saved:
    'border-emerald-600/30 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-300',
  pending:
    'border-amber-600/30 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-300',
  dirty: 'border-primary/30 bg-primary-soft text-primary-soft-fg',
  busy: 'border-primary/25 bg-primary-soft text-primary-soft-fg',
  queued: 'border-border bg-muted text-muted-foreground',
  failed: 'border-destructive/35 bg-destructive/10 text-destructive',
}

function StatusBadge({ status, title }: { status: ItemStatus; title?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-semibold leading-4 ${TONE_CLASS[status.tone]}`}
      title={title}
    >
      {status.spinning ? (
        <Loader2 aria-hidden className="size-2.5 animate-spin" strokeWidth={2.5} />
      ) : status.tone === 'saved' ? (
        <Check aria-hidden className="size-2.5" strokeWidth={3} />
      ) : status.tone === 'pending' || status.tone === 'dirty' ? (
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
      ) : null}
      {status.label}
    </span>
  )
}

function failureMessage(item: BatchItem): string | undefined {
  if (item.upload.kind === 'failed') return item.upload.message
  if (item.save.kind === 'failed') return item.save.message
  return undefined
}

function thumbnailUrl(item: BatchItem): string {
  return item.upload.kind === 'ready'
    ? item.upload.media.thumbUrl || item.upload.media.url
    : item.previewUrl
}

export function BatchFileList({
  items,
  selectedId,
  onSelect,
  onRemove,
  onRetry,
  onAddFiles,
}: BatchFileListProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savedCount = items.filter((item) => savedCardId(item.save) != null).length
  const pendingCount = items.filter(
    (item) => item.upload.kind === 'ready' && savedCardId(item.save) == null,
  ).length

  const acceptFiles = (files: File[]): void => {
    if (files.length === 0) return
    const images = files.filter((file) => file.type.startsWith('image/'))
    setError(images.length === files.length ? null : '只能上传图片文件')
    if (images.length > 0) onAddFiles(images)
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    acceptFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>): void => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setDragging(false)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDragging(false)
    acceptFiles(Array.from(event.dataTransfer.files))
  }

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col ${dragging ? 'bg-secondary ring-2 ring-inset ring-primary/40' : ''}`}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold leading-6">批量上架</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
            <span className="tabular">{items.length} 张图片</span>
            {savedCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <span aria-hidden className="size-1.5 rounded-full bg-emerald-600" />
                <span className="tabular text-emerald-700 dark:text-emerald-400">
                  {savedCount} 已保存
                </span>
              </span>
            ) : null}
            {pendingCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <span aria-hidden className="size-1.5 rounded-full bg-amber-500" />
                <span className="tabular text-amber-700 dark:text-amber-400">
                  {pendingCount} 未填写
                </span>
              </span>
            ) : null}
          </p>
        </div>
        <button
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <Plus aria-hidden className="size-3.5" strokeWidth={2.5} />
          添加文件
        </button>
        <input
          ref={inputRef}
          accept="image/*"
          className="hidden"
          multiple
          onChange={handleInputChange}
          type="file"
        />
      </header>

      {error ? (
        <p className="border-b border-border px-4 py-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full border border-dashed border-border bg-secondary/60">
            <Upload className="size-6 text-muted-foreground" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">把卡图拖到这里</p>
            <p className="mt-0.5 text-xs text-muted-foreground">或点击「添加文件」多选上传</p>
          </div>
        </div>
      ) : (
        <ul aria-label="待处理图片列表" className="flex-1 overflow-y-auto">
          {items.map((item) => {
            const selected = item.id === selectedId
            const uploading = item.upload.kind === 'uploading' ? item.upload : null
            const cardId = savedCardId(item.save)
            const saved = cardId != null
            const status = itemStatus(item)
            const failure = failureMessage(item)
            return (
              <li
                className={`relative border-b border-b-border last:border-b-0 ${
                  selected ? 'bg-primary-soft' : 'hover:bg-secondary'
                }`}
                key={item.id}
              >
                {/* 选中态用左侧短竖条，代替整行描边：行高更稳，也不挤占缩略图空间。 */}
                <span
                  aria-hidden
                  className={`absolute inset-y-2 left-0 w-[3px] rounded-r-full ${
                    selected ? 'bg-primary' : 'bg-transparent'
                  }`}
                />
                <div className="flex items-center gap-1 py-2 pl-3 pr-1.5">
                  <button
                    aria-current={selected ? 'true' : undefined}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    onClick={() => onSelect(item.id)}
                    type="button"
                  >
                    <span className="relative shrink-0">
                      {/* 媒体经过 302 跳到 B2，next/image 无法优化，必须用原生 img。 */}
                      <img
                        alt={item.draft.alt || item.file.name}
                        className={`size-12 rounded-md object-cover ring-1 ring-border ${
                          saved ? 'opacity-85' : ''
                        }`}
                        height={48}
                        loading="lazy"
                        src={thumbnailUrl(item)}
                        width={48}
                      />
                      {saved ? (
                        <span
                          aria-hidden
                          className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-card"
                        >
                          <Check className="size-2.5" strokeWidth={3} />
                        </span>
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-[13px] font-medium text-foreground"
                        title={item.file.name}
                      >
                        {item.file.name}
                      </span>
                      <span className="mt-1 flex min-w-0 items-center gap-2">
                        <span className="tabular flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                          {cardId != null ? (
                            <>
                              <span title={`卡牌 #${cardId}`}>#{cardId}</span>
                              <span aria-hidden className="text-border">
                                ·
                              </span>
                            </>
                          ) : null}
                          <span>{formatSize(item.file.size)}</span>
                        </span>
                        <span className="ml-auto">
                          <StatusBadge status={status} title={failure} />
                        </span>
                      </span>
                    </span>
                  </button>

                  {item.upload.kind === 'failed' ? (
                    <button
                      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-primary-soft-fg hover:bg-primary-soft"
                      onClick={() => onRetry(item.id)}
                      type="button"
                    >
                      <RotateCcw aria-hidden className="size-3" strokeWidth={2.5} />
                      重试
                    </button>
                  ) : null}

                  {saved ? null : (
                    <button
                      aria-label={`移除 ${item.file.name}`}
                      className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onRemove(item.id)}
                      title="移除"
                      type="button"
                    >
                      <X aria-hidden className="size-3.5" strokeWidth={2.5} />
                    </button>
                  )}
                </div>

                {uploading ? (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-0 h-0.5 rounded-r-full bg-primary transition-[width] duration-150"
                    style={{ width: `${progressPercent(uploading)}%` }}
                  />
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default BatchFileList
