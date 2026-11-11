'use client'

import { Upload } from 'lucide-react'
import React, { useRef, useState } from 'react'

import type { BatchItem, UploadState } from './batch-state'

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

function statusLabel(item: BatchItem): string {
  if (item.save.kind === 'saved') return '已保存'
  if (item.upload.kind === 'ready') {
    if (item.save.kind === 'saving') return '保存中'
    if (item.save.kind === 'failed') return '保存失败'
  }

  switch (item.upload.kind) {
    case 'queued':
    case 'requesting':
      return '排队中'
    case 'uploading':
      return `上传中 ${progressPercent(item.upload)}%`
    case 'processing':
      return '处理中'
    case 'ready':
      return '待填写'
    case 'failed':
      return '上传失败'
  }
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
  const savedCount = items.filter((item) => item.save.kind === 'saved').length

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
        <div>
          <h1 className="text-[15px] font-semibold leading-6">批量上架</h1>
          <p className="tabular mt-0.5 text-xs text-muted-foreground">
            {items.length} 张图片{savedCount > 0 ? ` · ${savedCount} 已保存` : ''}
          </p>
        </div>
        <button
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
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
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary">
            <Upload className="size-5 text-muted-foreground" />
          </span>
          <p className="text-sm text-muted-foreground">把卡图拖到这里，或点击添加文件</p>
        </div>
      ) : (
        <ul aria-label="待处理图片列表" className="flex-1 overflow-y-auto">
          {items.map((item) => {
            const selected = item.id === selectedId
            const uploading = item.upload.kind === 'uploading' ? item.upload : null
            const saved = item.save.kind === 'saved'
            const rowFailed = item.upload.kind === 'failed' || item.save.kind === 'failed'
            return (
              <li
                className={`relative flex items-center gap-1 border-b border-l-2 border-b-border pl-2 pr-1.5 last:border-b-0 ${
                  selected
                    ? 'border-l-primary bg-primary-soft'
                    : 'border-l-transparent hover:bg-secondary'
                }`}
                key={item.id}
              >
                <button
                  aria-current={selected ? 'true' : undefined}
                  className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left"
                  onClick={() => onSelect(item.id)}
                  type="button"
                >
                  {/* 媒体经过 302 跳到 B2，next/image 无法优化，必须用原生 img。 */}
                  <img
                    alt={item.draft.alt || item.file.name}
                    className={`size-10 shrink-0 rounded-sm object-cover ${saved ? 'opacity-60' : ''}`}
                    height={40}
                    loading="lazy"
                    src={thumbnailUrl(item)}
                    width={40}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-xs font-medium text-foreground"
                      title={item.file.name}
                    >
                      {item.file.name}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="tabular">{formatSize(item.file.size)}</span>
                      <span
                        className={rowFailed ? 'text-destructive' : undefined}
                        title={failureMessage(item)}
                      >
                        {statusLabel(item)}
                      </span>
                    </span>
                  </span>
                </button>

                {item.upload.kind === 'failed' ? (
                  <button
                    className="rounded-sm px-1.5 py-1 text-[11px] font-medium text-primary-soft-fg hover:bg-primary-soft"
                    onClick={() => onRetry(item.id)}
                    type="button"
                  >
                    重试
                  </button>
                ) : null}

                {saved ? null : (
                  <button
                    aria-label={`移除 ${item.file.name}`}
                    className="flex size-6 shrink-0 items-center justify-center rounded-sm text-sm leading-none text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onRemove(item.id)}
                    title="移除"
                    type="button"
                  >
                    ×
                  </button>
                )}

                {uploading ? (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-0 h-0.5 bg-primary transition-[width] duration-150"
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
