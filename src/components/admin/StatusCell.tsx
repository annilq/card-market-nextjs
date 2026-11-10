import { getTranslation } from '@payloadcms/translations'
import type { DefaultServerCellComponentProps } from 'payload'
import React from 'react'

import { AdminLocalDateTime } from './AdminLocalDateTime'
import { StatusQuickSelect, type StatusOption } from './StatusQuickSelect'

/**
 * 列表里的「状态」单元格：一枚带语义色的胶囊，**并且可以直接在列表里改**。
 *
 * 为什么值得做：状态列原来是纯文字，和旁边「卡牌名称 / 编号」这些普通文字
 * 长得一模一样——扫一列下来看不出哪几行是草稿（或哪几张工单还是「新」）；
 * 而状态又是这个后台每天改得最多的字段，改一次要进详情页四步。
 *
 * 语义只有三档，红始终留给错误提示：
 *   绿 = 生效中 / 已处理（published、processed）
 *   琥珀 = 需要留意（new、定时未到点）
 *   中性 = 未生效或已终止（draft、archived、spam）
 *
 * 文案仍然走后台的翻译（选项上的 { zh, en, ja }），不在这里写死中文——
 * 切到日语界面时胶囊里要是中文，比没有颜色更糟。
 */

/** value → 语义档位。 */
const TONE: Record<string, string> = {
  archived: 'muted',
  draft: 'muted',
  new: 'scheduled',
  processed: 'published',
  published: 'published',
  spam: 'muted',
}

export function StatusCell({ cellData, collectionSlug, field, i18n, rowData }: DefaultServerCellComponentProps) {
  const value = typeof cellData === 'string' ? cellData : undefined
  if (value == null) return null

  // 选项的标签可能是字符串，也可能是 { zh, en, ja }；取当前界面语言那一份。
  const options: StatusOption[] =
    field?.type === 'select'
      ? (field.options ?? []).flatMap((o) => {
          const raw = typeof o === 'object' ? o.value : o
          const label = typeof o === 'object' ? o.label : o
          if (typeof raw !== 'string') return []
          return [
            {
              value: raw,
              // 选项标签是 { zh, en, ja }；getTranslation 取当前界面语言那一份
              label: typeof label === 'string' ? label : (getTranslation(label, i18n) as string),
            },
          ]
        })
      : [{ value, label: value }]

  if (options.length === 0) return null

  const docId = (rowData as { id?: number | string } | undefined)?.id
  // 没有 id（理论上不会）时退化成只读胶囊，至少状态还是读得出来的
  const readOnly = docId == null

  // 定时发布：状态已经是「已发布」，但发布时间还没到——列表里必须看得出差别，
  // 否则运营无法回答「这条上线了没有」（定时内容里风险最高的一个问题）。
  const scheduledAt = (() => {
    const raw = (rowData as { publishedAt?: string | number | Date } | undefined)?.publishedAt
    if (raw == null || value !== 'published') return null
    const time = new Date(raw as string).getTime()
    return Number.isFinite(time) && time > Date.now() ? time : null
  })()

  return (
    <span className="admin-status__group">
      {readOnly ? (
        <span className={`admin-status admin-status--${TONE[value] ?? 'muted'}`}>
          {options.find((o) => o.value === value)?.label ?? value}
        </span>
      ) : (
        <StatusQuickSelect
          collectionSlug={collectionSlug}
          docId={docId}
          options={options}
          tone={TONE[value] ?? 'muted'}
          value={value}
        />
      )}
      {scheduledAt ? (
        <span className="admin-status admin-status--scheduled">
          定时 · <AdminLocalDateTime value={scheduledAt} />
        </span>
      ) : null}
    </span>
  )
}
