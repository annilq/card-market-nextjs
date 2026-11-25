'use client'

import React, { useEffect, useRef, useState } from 'react'

import type { BatchItem, BulkCardsTaxonomy, CardDraft } from './batch-state'
import { draftEquals, savedCardId } from './batch-state'
import { hasDraftErrors, validateCardDraft } from './card-draft'
import { useAdminT } from '@/lib/admin/i18n/use-admin-t'

import { TaxonomySelect } from './TaxonomySelect'

const INPUT_CLASS =
  'h-9 w-full rounded-md border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type CardDraftFormProps = {
  item: BatchItem
  taxonomy: BulkCardsTaxonomy
  onChange: (changes: Partial<CardDraft>) => void
  onSave: () => void
}

export function CardDraftForm({ item, taxonomy, onChange, onSave }: CardDraftFormProps) {
  const t = useAdminT()
  const statusOptions: { value: CardDraft['status']; label: string }[] = [
    { value: 'draft', label: t('status.draft') },
    { value: 'published', label: t('status.published') },
    { value: 'archived', label: t('status.archived') },
  ]
  const [submitted, setSubmitted] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const { draft, save } = item
  const cardId = savedCardId(save)
  const saving = save.kind === 'saving'
  const updating = save.kind === 'updating'
  const busy = saving || updating
  const dirty = cardId != null && item.savedSnapshot != null && !draftEquals(draft, item.savedSnapshot)
  const validation = submitted ? validateCardDraft(draft, t) : {}
  const saveError = save.kind === 'failed' ? save : null

  const errorFor = (field: keyof CardDraft): string | undefined =>
    validation[field] ?? (saveError?.field === field ? saveError.message : undefined)

  const selectErrorFor = (field: keyof CardDraft): string | undefined => errorFor(field)

  const seriesOptions = taxonomy.series.filter((option) => option.ipId === draft.ipId)
  const subSeriesOptions = taxonomy.subSeries.filter((option) => option.seriesId === draft.seriesId)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== 'Enter') return
      event.preventDefault()
      formRef.current?.requestSubmit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (busy || item.upload.kind !== 'ready') return
    setSubmitted(true)
    if (hasDraftErrors(validateCardDraft(draft, t))) return
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
            disabled={busy}
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
            disabled={busy}
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
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} ref={formRef}>
      <fieldset className="flex flex-col gap-4" disabled={busy}>
        <div className="grid gap-3 sm:grid-cols-2">
          {textField('name', t('bulk.cardName'), {
            required: true,
            placeholder: t('bulk.cardNamePlaceholder'),
          })}
          <label className="flex min-w-0 flex-col gap-1.5" htmlFor="bulk-alt">
            <span className="text-xs font-medium text-muted-foreground">
              {t('bulk.alt')}
              <span className="ml-0.5 text-primary-soft-fg">*</span>
            </span>
            <input
              className={`${INPUT_CLASS} ${errorFor('alt') ? 'border-destructive' : 'border-input'}`}
              disabled={busy}
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
            label={t('bulk.ip')}
            onChange={(ipId) => onChange({ ipId, seriesId: null, subSeriesId: null })}
            options={taxonomy.ips}
            placeholder={t('common.pleaseSelect')}
            value={draft.ipId}
          />
          <TaxonomySelect
            disabled={draft.ipId == null}
            error={selectErrorFor('seriesId')}
            label={t('bulk.series')}
            onChange={(seriesId) => onChange({ seriesId, subSeriesId: null })}
            options={seriesOptions}
            placeholder={draft.ipId == null ? t('common.selectIpFirst') : t('common.pleaseSelect')}
            value={draft.seriesId}
          />
          <TaxonomySelect
            disabled={draft.seriesId == null}
            error={selectErrorFor('subSeriesId')}
            label={t('bulk.subSeries')}
            onChange={(subSeriesId) => onChange({ subSeriesId })}
            options={subSeriesOptions}
            placeholder={draft.seriesId == null ? t('common.selectSeriesFirst') : t('common.pleaseSelect')}
            value={draft.subSeriesId}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <TaxonomySelect
            error={selectErrorFor('rarityId')}
            label={t('bulk.rarity')}
            onChange={(rarityId) => onChange({ rarityId })}
            options={taxonomy.rarities}
            placeholder={t('common.pleaseSelect')}
            value={draft.rarityId}
          />
          {textField('code', t('bulk.code'), { placeholder: t('bulk.codePlaceholder') })}
          {textField('price', t('bulk.price'), {
            placeholder: t('bulk.pricePlaceholder'),
            type: 'number',
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <TaxonomySelect
            error={selectErrorFor('cardStatusId')}
            label={t('bulk.cardStatus')}
            onChange={(cardStatusId) => onChange({ cardStatusId })}
            options={taxonomy.cardStatuses}
            placeholder={t('common.pleaseSelect')}
            value={draft.cardStatusId}
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="bulk-status">
              {t('bulk.publishStatus')}
            </label>
            <select
              className={`${INPUT_CLASS} border-input`}
              disabled={busy}
              id="bulk-status"
              onChange={(event) => onChange({ status: event.target.value as CardDraft['status'] })}
              value={draft.status}
            >
              {statusOptions.map((option) => (
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
              disabled={busy}
              id="bulk-high-value"
              onChange={(event) =>
                onChange(event.target.checked
                  ? { isHighValue: true, isNoDeduction: false, stopBuyback: false }
                  : { isHighValue: false })
              }
              type="checkbox"
            />
            <span className="text-sm">{t('bulk.highValue')}</span>
          </label>
          <label className="flex items-center gap-2 self-end pb-1.5" htmlFor="bulk-no-deduction">
            <input
              checked={draft.isNoDeduction}
              className="size-4 accent-[var(--primary)]"
              disabled={busy}
              id="bulk-no-deduction"
              onChange={(event) =>
                onChange(event.target.checked
                  ? { isNoDeduction: true, isHighValue: false, stopBuyback: false }
                  : { isNoDeduction: false })
              }
              type="checkbox"
            />
            <span className="text-sm">{t('bulk.noDeduction')}</span>
          </label>
          <label className="flex items-center gap-2 self-end pb-1.5" htmlFor="bulk-stop-buyback">
            <input
              checked={draft.stopBuyback}
              className="size-4 accent-[var(--primary)]"
              disabled={busy}
              id="bulk-stop-buyback"
              onChange={(event) =>
                onChange(event.target.checked
                  ? { stopBuyback: true, isHighValue: false, isNoDeduction: false }
                  : { stopBuyback: false })
              }
              type="checkbox"
            />
            <span className="text-sm">{t('bulk.stopBuyback')}</span>
          </label>
        </div>

        {textField('description', t('bulk.description'), {
          multiline: true,
          placeholder: t('bulk.descriptionPlaceholder'),
        })}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy || item.upload.kind !== 'ready'}
          type="submit"
        >
          {updating
            ? t('bulk.updating')
            : saving
              ? t('bulk.saving')
              : cardId != null
                ? t('bulk.updateCard')
                : t('bulk.saveCard')}
        </button>

        {saveError ? (
          <p className="text-xs text-destructive" role="alert">
            {saveError.message}
          </p>
        ) : cardId != null ? (
          <p className="text-xs text-muted-foreground">
            {dirty
              ? t('bulk.dirty', { id: cardId })
              : t('bulk.savedAs', { id: cardId })}
          </p>
        ) : item.upload.kind !== 'ready' ? (
          <p className="text-xs text-muted-foreground">{t('bulk.uploadFirst')}</p>
        ) : null}

        <p className="ml-auto text-[11px] text-muted-foreground">{t('bulk.shortcuts')}</p>
      </div>
    </form>
  )
}

export default CardDraftForm
