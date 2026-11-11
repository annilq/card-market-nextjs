'use client'

import { Upload } from 'lucide-react'
import React from 'react'

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

export function BulkCardsClient(_props: BulkCardsClientProps) {
  return (
    <div
      className="flex h-[calc(100vh-100px)] min-h-[520px] flex-col gap-4 lg:flex-row"
      data-admin-ui=""
    >
      <aside
        aria-label="待处理图片"
        className="flex min-h-[320px] flex-col overflow-hidden rounded-lg border border-border bg-card lg:min-h-0 lg:w-[360px] lg:shrink-0"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h1 className="text-[15px] font-semibold leading-6">批量上架</h1>
            <p className="tabular mt-0.5 text-xs text-muted-foreground">0 张待处理</p>
          </div>
          <button
            className="rounded-md border border-input bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground disabled:cursor-not-allowed disabled:opacity-70"
            disabled
            type="button"
          >
            添加文件
          </button>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary">
            <Upload className="size-5 text-muted-foreground" />
          </span>
          <p className="text-sm text-muted-foreground">把卡图拖到这里，或点击添加文件</p>
        </div>
      </aside>

      <section
        aria-label="卡牌信息"
        className="flex min-h-[320px] flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 text-center lg:min-h-0"
      >
        <p className="text-sm text-muted-foreground">选择左侧图片后填写卡牌信息</p>
      </section>
    </div>
  )
}

export default BulkCardsClient
