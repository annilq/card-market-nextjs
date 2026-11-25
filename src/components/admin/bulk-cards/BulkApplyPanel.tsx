'use client'

import React, { useState } from 'react'

import { useAdminT } from '@/lib/admin/i18n/use-admin-t'

import type { BulkCardsTaxonomy, CardDraft } from './batch-state'
import { TaxonomySelect } from './TaxonomySelect'

export type BulkApplyChanges = Partial<
  Pick<CardDraft, 'ipId' | 'seriesId' | 'subSeriesId' | 'rarityId' | 'cardStatusId' | 'status'>
>

export type BulkApplyPanelProps = {
  taxonomy: BulkCardsTaxonomy
  onApply: (changes: BulkApplyChanges) => number
}

export function BulkApplyPanel({ taxonomy, onApply }: BulkApplyPanelProps) {
  const t = useAdminT()
  const statusOptions: { value: CardDraft['status']; label: string }[] = [
    { value: 'draft', label: t('status.draft') },
    { value: 'published', label: t('status.published') },
    { value: 'archived', label: t('status.archived') },
  ]
  const [ipId, setIpId] = useState<number | null>(null)
  const [seriesId, setSeriesId] = useState<number | null>(null)
  const [subSeriesId, setSubSeriesId] = useState<number | null>(null)
  const [rarityId, setRarityId] = useState<number | null>(null)
  const [cardStatusId, setCardStatusId] = useState<number | null>(null)
  const [status, setStatus] = useState<CardDraft['status'] | ''>('')
  const [message, setMessage] = useState<string | null>(null)

  const seriesOptions = taxonomy.series.filter((option) => option.ipId === ipId)
  const subSeriesOptions = taxonomy.subSeries.filter((option) => option.seriesId === seriesId)
  const canApply =
    ipId != null ||
    seriesId != null ||
    subSeriesId != null ||
    rarityId != null ||
    cardStatusId != null ||
    status !== ''

  const apply = (): void => {
    const changes: BulkApplyChanges = {}
    if (ipId != null) changes.ipId = ipId
    if (seriesId != null) changes.seriesId = seriesId
    if (subSeriesId != null) changes.subSeriesId = subSeriesId
    if (rarityId != null) changes.rarityId = rarityId
    if (cardStatusId != null) changes.cardStatusId = cardStatusId
    if (status !== '') changes.status = status

    // 换 IP 后旧的系列组合不再有效，一起清掉，避免批量填出互相矛盾的分类。
    if (ipId != null && seriesId == null) {
      changes.seriesId = null
      changes.subSeriesId = null
    } else if (seriesId != null && subSeriesId == null) {
      changes.subSeriesId = null
    }

    const count = onApply(changes)
    setMessage(
      count > 0 ? t('bulk.apply.filled', { count }) : t('bulk.apply.none'),
    )
  }

  return (
    <details className="rounded-lg border border-border bg-card">
      <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">
        {t('bulk.apply.title')}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {t('bulk.apply.hint')}
        </span>
      </summary>
      <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-3">
        <TaxonomySelect
          label={t('bulk.ip')}
          onChange={(value) => {
            setIpId(value)
            setSeriesId(null)
            setSubSeriesId(null)
          }}
          options={taxonomy.ips}
          placeholder={t('bulk.apply.noChange')}
          value={ipId}
        />
        <TaxonomySelect
          disabled={ipId == null}
          label={t('bulk.series')}
          onChange={(value) => {
            setSeriesId(value)
            setSubSeriesId(null)
          }}
          options={seriesOptions}
          placeholder={ipId == null ? t('common.selectIpFirst') : t('bulk.apply.noChange')}
          value={seriesId}
        />
        <TaxonomySelect
          disabled={seriesId == null}
          label={t('bulk.subSeries')}
          onChange={setSubSeriesId}
          options={subSeriesOptions}
          placeholder={seriesId == null ? t('common.selectSeriesFirst') : t('bulk.apply.noChange')}
          value={subSeriesId}
        />
        <TaxonomySelect
          label={t('bulk.rarity')}
          onChange={setRarityId}
          options={taxonomy.rarities}
          placeholder={t('bulk.apply.noChange')}
          value={rarityId}
        />
        <TaxonomySelect
          label={t('bulk.cardStatus')}
          onChange={setCardStatusId}
          options={taxonomy.cardStatuses}
          placeholder={t('bulk.apply.noChange')}
          value={cardStatusId}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="bulk-apply-status">
            {t('bulk.publishStatus')}
          </label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="bulk-apply-status"
            onChange={(event) => setStatus(event.target.value as CardDraft['status'] | '')}
            value={status}
          >
            <option value="">{t('bulk.apply.noChange')}</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <button
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canApply}
            onClick={apply}
            type="button"
          >
            {t('bulk.apply.action')}
          </button>
          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
        </div>
      </div>
    </details>
  )
}

export default BulkApplyPanel
