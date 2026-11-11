'use client'

import React, { useState } from 'react'

import type { BulkCardsTaxonomy, CardDraft } from './batch-state'
import { TaxonomySelect } from './TaxonomySelect'

export type BulkApplyChanges = Partial<
  Pick<CardDraft, 'ipId' | 'seriesId' | 'subSeriesId' | 'rarityId' | 'cardStatusId' | 'status'>
>

const STATUS_OPTIONS: { value: CardDraft['status']; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
]

export type BulkApplyPanelProps = {
  taxonomy: BulkCardsTaxonomy
  onApply: (changes: BulkApplyChanges) => number
}

export function BulkApplyPanel({ taxonomy, onApply }: BulkApplyPanelProps) {
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
    setMessage(count > 0 ? `已填充 ${count} 张未保存的图片` : '没有可填充的未保存图片')
  }

  return (
    <details className="rounded-lg border border-border bg-card">
      <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">
        批量填充分类
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          只影响尚未保存的图片
        </span>
      </summary>
      <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-3">
        <TaxonomySelect
          label="IP / 大类"
          onChange={(value) => {
            setIpId(value)
            setSeriesId(null)
            setSubSeriesId(null)
          }}
          options={taxonomy.ips}
          placeholder="不修改"
          value={ipId}
        />
        <TaxonomySelect
          disabled={ipId == null}
          label="系列"
          onChange={(value) => {
            setSeriesId(value)
            setSubSeriesId(null)
          }}
          options={seriesOptions}
          placeholder={ipId == null ? '先选 IP' : '不修改'}
          value={seriesId}
        />
        <TaxonomySelect
          disabled={seriesId == null}
          label="子系列"
          onChange={setSubSeriesId}
          options={subSeriesOptions}
          placeholder={seriesId == null ? '先选系列' : '不修改'}
          value={subSeriesId}
        />
        <TaxonomySelect
          label="稀有程度"
          onChange={setRarityId}
          options={taxonomy.rarities}
          placeholder="不修改"
          value={rarityId}
        />
        <TaxonomySelect
          label="卡牌状态"
          onChange={setCardStatusId}
          options={taxonomy.cardStatuses}
          placeholder="不修改"
          value={cardStatusId}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="bulk-apply-status">
            发布状态
          </label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="bulk-apply-status"
            onChange={(event) => setStatus(event.target.value as CardDraft['status'] | '')}
            value={status}
          >
            <option value="">不修改</option>
            {STATUS_OPTIONS.map((option) => (
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
            应用到未保存的图片
          </button>
          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
        </div>
      </div>
    </details>
  )
}

export default BulkApplyPanel
