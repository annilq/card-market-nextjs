'use client'

import React, { useState } from 'react'

import type { BatchItem, BulkCardsTaxonomy, CardDraft } from './batch-state'
import { hasDraftErrors, validateCardDraft } from './card-draft'
import { TaxonomySelect } from './TaxonomySelect'

const STATUS_OPTIONS: { value: CardDraft['status']; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
]

const INPUT_CLASS =
  'h-9 w-full rounded-md border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type CardDraftFormProps = {
  item: BatchItem
  taxonomy: BulkCardsTaxonomy
  onChange: (changes: Partial<CardDraft>) => void
  onSave: () => void
}

export function CardDraftForm({ item, taxonomy, onChange, onSave }: CardDraftFormProps) {
  const [submitted, setSubmitted] = useState(false)
  const { draft, save } = item
  const locked = save.kind === 'saved'
  const saving = save.kind === 'saving'
  const validation = submitted ? validateCardDraft(draft) : {}
  const saveError = save.kind === 'failed' ? save : null

  const errorFor = (field: keyof CardDraft): string | undefined =>
    validation[field] ?? (saveError?.field === field ? saveError.message : undefined)

  const selectErrorFor = (field: keyof CardDraft): string | undefined => errorFor(field)

  const seriesOptions = taxonomy.series.filter((option) => option.ipId === draft.ipId)
  const subSeriesOptions = taxonomy.subSeries.filter((option) => option.seriesId === draft.seriesId)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (locked || saving) return
    setSubmitted(true)
    if (hasDraftErrors(validateCardDraft(draft))) return
    onSave()
  }

  const textField = (
    field: 'name' | 'code' | 'price' | 'description',
    label: string,
    options: {
      required?: boolean
      placeholder?: string
      type?: string
      multiline?: boolean
    } = {},
  ) => {
    const error = errorFor(field)
    const id = `bulk-${field}`
    const className = `${INPUT_CLASS} ${options.multiline ? 'h-auto min-h-24 py-2' : ''} ${
      error ? 'border-destructive' : 'border-input'
    }`

    return (
      <label className="flex min-w-0 flex-col gap-1.5" htmlFor={id}>
        <span className="text-xs font-medium text-muted-foreground">
          {label}
          {options.required ? <span className="ml-0.5 text-primary-soft-fg">*</span> : null}
        </span>
        {options.multiline ? (
          <textarea
            className={className}
            disabled={locked}
            id={id}
            onChange={(event) =>
              onChange({ [field]: event.target.value } as Partial<CardDraft>)
            }
            placeholder={options.placeholder}
            value={draft[field]}
          />
        ) : (
          <input
            className={className}
            disabled={locked}
            id={id}
            inputMode={field === 'price' ? 'decimal' : undefined}
            min={field === 'price' ? 0 : undefined}
            onChange={(event) =>
              onChange({ [field]: event.target.value } as Partial<CardDraft>)
            }
            placeholder={options.placeholder}
            step={field === 'price' ? 1 : undefined}
            type={options.type ?? 'text'}
            value={draft[field]}
          />
        )}
        {error ? <span className="text-[11px] text-destructive">{error}</span> : null}
      </label>
    )
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <fieldset className="flex flex-col gap-4" disabled={locked || saving}>
        <div className="grid gap-3 sm:grid-cols-2">
          {textField('name', '卡牌名称', { required: true, placeholder: '如 皮卡丘' })}
          <label className="flex min-w-0 flex-col gap-1.5" htmlFor="bulk-alt">
            <span className="text-xs font-medium text-muted-foreground">
              替代文本<span className="ml-0.5 text-primary-soft-fg">*</span>
            </span>
            <input
              className={`${INPUT_CLASS} ${errorFor('alt') ? 'border-destructive' : 'border-input'}`}
              disabled={locked}
              id="bulk-alt"
              onChange={(event) => onChange({ alt: event.target.value })}
              value={draft.alt}
            />
            {errorFor('alt') ? (
              <span className="text-[11px] text-destructive">{errorFor('alt')}</span>
            ) : null}
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <TaxonomySelect
            error={selectErrorFor('ipId')}
            label="IP / 大类"
            onChange={(ipId) => onChange({ ipId, seriesId: null, subSeriesId: null })}
            options={taxonomy.ips}
            placeholder="请选择"
            value={draft.ipId}
          />
          <TaxonomySelect
            disabled={draft.ipId == null}
            error={selectErrorFor('seriesId')}
            label="系列"
            onChange={(seriesId) => onChange({ seriesId, subSeriesId: null })}
            options={seriesOptions}
            placeholder={draft.ipId == null ? '先选 IP' : '请选择'}
            value={draft.seriesId}
          />
          <TaxonomySelect
            disabled={draft.seriesId == null}
            error={selectErrorFor('subSeriesId')}
            label="子系列"
            onChange={(subSeriesId) => onChange({ subSeriesId })}
            options={subSeriesOptions}
            placeholder={draft.seriesId == null ? '先选系列' : '请选择'}
            value={draft.subSeriesId}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <TaxonomySelect
            error={selectErrorFor('rarityId')}
            label="稀有程度"
            onChange={(rarityId) => onChange({ rarityId })}
            options={taxonomy.rarities}
            placeholder="请选择"
            value={draft.rarityId}
          />
          {textField('code', '收藏编号', { placeholder: '如 123/197' })}
          {textField('price', '卖价', { placeholder: '如 320', type: 'number' })}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <TaxonomySelect
            error={selectErrorFor('cardStatusId')}
            label="卡牌状态"
            onChange={(cardStatusId) => onChange({ cardStatusId })}
            options={taxonomy.cardStatuses}
            placeholder="请选择"
            value={draft.cardStatusId}
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="bulk-status">
              发布状态
            </label>
            <select
              className={`${INPUT_CLASS} border-input`}
              disabled={locked}
              id="bulk-status"
              onChange={(event) => onChange({ status: event.target.value as CardDraft['status'] })}
              value={draft.status}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 self-end pb-1.5" htmlFor="bulk-high-value">
            <input
              checked={draft.isHighValue}
              className="size-4 accent-[var(--primary)]"
              disabled={locked}
              id="bulk-high-value"
              onChange={(event) => onChange({ isHighValue: event.target.checked })}
              type="checkbox"
            />
            <span className="text-sm">高价买取</span>
          </label>
        </div>

        {textField('description', '描述', {
          multiline: true,
          placeholder: '可选，支持换行分段。',
        })}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={locked || saving || item.upload.kind !== 'ready'}
          type="submit"
        >
          {saving ? '保存中…' : locked ? '已保存' : '保存卡牌'}
        </button>

        {save.kind === 'saved' ? (
          <p className="text-xs text-muted-foreground">
            已保存为卡牌 #{save.cardId}，继续选择左侧下一张图片。
          </p>
        ) : saveError ? (
          <p className="text-xs text-destructive" role="alert">
            {saveError.message}
          </p>
        ) : item.upload.kind !== 'ready' ? (
          <p className="text-xs text-muted-foreground">图片上传完成后才能保存。</p>
        ) : null}
      </div>
    </form>
  )
}

export default CardDraftForm
