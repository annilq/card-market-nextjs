import { APIError, type CollectionConfig, type Where } from 'payload'

import { isAdmin, publishedOnly } from '@/access'
import { statusField } from '@/fields/shared'

const relId = (value: unknown): string | number | null => {
  if (!value) return null
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return (value as { id: string | number }).id
  }
  return value as string | number
}

/**
 * 组合唯一键：(ip, series, subSeries, code)。
 * Payload 没有复合唯一索引，这里用「计算列 + unique」+ 钩子显式报错实现同等效果
 * （Directus 版本是在 Postgres 上建 (ip_id, series_id, sub_series_id, code) 唯一索引）。
 */
export const buildCardDedupeKey = (data: Record<string, unknown>): string | null => {
  const code = (data?.code ?? '').toString().trim()
  if (!code) return null
  return [relId(data.ip), relId(data.series), relId(data.subSeries), code].join('::')
}

export const Cards: CollectionConfig = {
  slug: 'cards',
  labels: {
    singular: { zh: '卡牌', en: 'Card', ja: 'カード' },
    plural: { zh: '卡牌', en: 'Cards', ja: 'カード' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'code', 'ip', 'price', 'isHighValue', 'status'],
    group: { zh: '商品', en: 'Catalog', ja: '商品' },
  },
  access: {
    read: publishedOnly,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req, operation }) => {
        const merged = { ...(originalDoc ?? {}), ...(data ?? {}) }
        const key = buildCardDedupeKey(merged as Record<string, unknown>)
        if (data) data.dedupeKey = key ?? undefined
        if (key) {
          const where: Where[] = [{ dedupeKey: { equals: key } }]
          if (operation === 'update' && originalDoc?.id) {
            where.push({ id: { not_equals: originalDoc.id } })
          }
          const dup = await req.payload.find({
            collection: 'cards',
            overrideAccess: true,
            limit: 1,
            where: { and: where },
          })
          if (dup.docs.length > 0) {
            throw new APIError('同一 IP / 系列 / 子系列 下的编号已存在', 400, { field: 'dedupeKey' }, true)
          }
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'name', label: { zh: '卡牌名称', en: 'Card name', ja: 'カード名' }, type: 'text', required: true, index: true },
    {
      type: 'row',
      fields: [
        {
          name: 'ip',
          label: { zh: 'IP / 大类', en: 'IP', ja: 'IP' },
          type: 'relationship',
          relationTo: 'ips',
          required: true,
          index: true,
          admin: { width: '33%' },
        },
        {
          name: 'series',
          label: { zh: '系列', en: 'Series', ja: 'シリーズ' },
          type: 'relationship',
          relationTo: 'series',
          required: true,
          index: true,
          admin: { width: '33%' },
          filterOptions: ({ siblingData }) => {
            const data = siblingData as { ip?: unknown } | undefined
            const where: Where = data?.ip ? { ip: { equals: data.ip } } : {}
            return where
          },
        },
        {
          name: 'subSeries',
          label: { zh: '子系列', en: 'Sub-series', ja: 'サブシリーズ' },
          type: 'relationship',
          relationTo: 'sub-series',
          required: true,
          index: true,
          admin: { width: '33%' },
          filterOptions: ({ siblingData }) => {
            const data = siblingData as { series?: unknown } | undefined
            const where: Where = data?.series ? { series: { equals: data.series } } : {}
            return where
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'rarity',
          label: { zh: '稀有程度', en: 'Rarity', ja: 'レアリティ' },
          type: 'relationship',
          relationTo: 'rarities',
          required: true,
          index: true,
          admin: { width: '33%' },
        },
        {
          name: 'code',
          label: { zh: '收藏编号', en: 'Code', ja: 'コレクション番号' },
          type: 'text',
          index: true,
          admin: { width: '33%', placeholder: { zh: '如 123/197', en: 'e.g. 123/197', ja: '例 123/197' } },
        },
        {
          name: 'price',
          label: { zh: '卖价', en: 'Price', ja: '販売価格' },
          type: 'number',
          index: true,
          admin: { width: '33%', step: 1 },
        },
      ],
    },
    {
      name: 'images',
      label: { zh: '卡牌图片', en: 'Images', ja: '画像' },
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
    },
    {
      name: 'description',
      label: { zh: '描述', en: 'Description', ja: '説明' },
      type: 'richText',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'isHighValue',
          label: { zh: '高价买取', en: 'High-value buyback', ja: '高価買取' },
          type: 'checkbox',
          defaultValue: false,
          index: true,
          admin: { width: '50%', description: { zh: '纯标识，仅供「只看精品」筛选', en: 'Flag only, used by the "high value" filter', ja: '「高価買取のみ」絞り込み用フラグ' } },
        },
        {
          name: 'cardStatus',
          label: { zh: '卡牌状态', en: 'Card condition type', ja: 'カード状態' },
          type: 'select',
          defaultValue: 'raw',
          required: true,
          options: [
            { label: { zh: '裸卡', en: 'Raw', ja: '裸' }, value: 'raw' },
            { label: { zh: '有包装', en: 'Packaged', ja: 'パッケージあり' }, value: 'packaged' },
          ],
          admin: { width: '50%' },
        },
      ],
    },
    statusField(),
    {
      name: 'dedupeKey',
      type: 'text',
      unique: true,
      index: true,
      admin: { hidden: true, readOnly: true, disableBulkEdit: true },
    },
  ],
}
