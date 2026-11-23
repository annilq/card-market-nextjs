import { APIError, type CollectionConfig } from 'payload'

import { publishedOnly } from '@/access'
import { moduleRead, roleAction } from '@/access/roles'
import { linkField, sortField, statusField } from '@/fields/shared'
import { revalidateHook } from '@/lib/revalidate'

const relId = (value: unknown): string | number | null => {
  if (!value) return null
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return (value as { id: string | number }).id
  }
  return value as string | number
}

const IP_LABEL = { en: 'IP', ja: 'IP', zh: 'IP / 大类' }
const SERIES_LABEL = { en: 'Series', ja: 'シリーズ', zh: '系列' }

/**
 * 三级分类共用同一个客户端字段组件（复用 Payload 原生 relationship 下拉的外观）。
 * `filterOptions` 只负责「下拉里能看到什么」，这里补的是两件它不做的事：
 * 上级变了清空下级、上级没选时点击下级弹出「请先选择 X」的提醒。
 */
const cascadingField = (cascade: {
  clearPaths?: string[]
  prerequisites?: { label: Record<string, string>; path: string }[]
}) => ({
  clientProps: { cascade },
  path: '@/components/admin/TaxonomyCascadeField#CascadingRelationshipField',
})

/** 三个买取标记互斥：最多选一个，也可以都不选。 */
const BUYBACK_FLAGS = ['isHighValue', 'isNoDeduction', 'stopBuyback'] as const

export const Cards: CollectionConfig = {
  slug: 'cards',
  labels: {
    singular: { zh: '卡牌', en: 'Card', ja: 'カード' },
    plural: { zh: '卡牌', en: 'Cards', ja: 'カード' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'code', 'ip', 'price', 'isHighValue', 'isNoDeduction', 'status', 'publicLink'],
    group: { zh: '商品', en: 'Catalog', ja: '商品' },
    // 后台列表搜索覆盖卡名 / 编号 / 稀有度名称。
    // 稀有度是关系字段，直接写 'rarity' 会被 Payload 的 like 降级成 equals（按 ID 比），
    // 必须写嵌套路径 'rarity.name' 才会 JOIN rarities 表按名称做子串匹配。
    listSearchableFields: ['name', 'code', 'rarity.name'],
  },
  access: {
    read: moduleRead('cards', publishedOnly),
    create: roleAction('cards', 'create'),
    update: roleAction('cards', 'update'),
    delete: roleAction('cards', 'delete'),
  },
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc }) => {
        const merged = { ...(originalDoc ?? {}), ...(data ?? {}) }
        // 三个买取标记互斥。后台表单已经即时联动，这里守住 REST / GraphQL / Local API 写入。
        const selected = BUYBACK_FLAGS.filter((name) => Boolean(merged[name]))
        if (selected.length > 1) {
          throw new APIError(
            '「高价买取」「不减额买取」「停止买取」只能选一个，或都不选',
            400,
            { field: selected[selected.length - 1] },
            true,
          )
        }
        if (!merged.stopBuyback) {
          const price = merged.price
          if (price == null || price === '' || (typeof price === 'number' && !Number.isFinite(price))) {
            throw new APIError('卖价必填；如需停止买取请勾选「停止买取」', 400, { field: 'price' }, true)
          }
        }
        return data
      },
    ],
    // 卡牌变动 → 列表/详情缓存 + 筛选维度缓存立即失效（改完秒级生效）。
    afterChange: [revalidateHook('cards', 'facets')],
    afterDelete: [revalidateHook('cards', 'facets')],
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
          // 根级：无前置条件；切换时连带清掉系列与子系列。
          admin: {
            width: '33%',
            components: { Field: cascadingField({ clearPaths: ['series', 'subSeries'] }) },
          },
        },
        {
          name: 'series',
          label: { zh: '系列', en: 'Series', ja: 'シリーズ' },
          type: 'relationship',
          relationTo: 'series',
          required: true,
          index: true,
          // 前置：必须先选 IP；本字段变化时清掉子系列。
          admin: {
            width: '33%',
            components: {
              Field: cascadingField({
                clearPaths: ['subSeries'],
                prerequisites: [{ label: IP_LABEL, path: 'ip' }],
              }),
            },
          },
          filterOptions: ({ siblingData }) => {
            const ipId = relId((siblingData as { ip?: unknown } | undefined)?.ip)
            // 没选 IP 时返回 false（Payload 会转成空结果），否则下拉会把全部系列一次性拉出来。
            return ipId ? { ip: { equals: ipId } } : false
          },
        },
        {
          name: 'subSeries',
          label: { zh: '子系列', en: 'Sub-series', ja: 'サブシリーズ' },
          type: 'relationship',
          relationTo: 'sub-series',
          required: true,
          index: true,
          // 前置链：IP → 系列。任一未选时点击都会提示先补哪一级。
          admin: {
            width: '33%',
            components: {
              Field: cascadingField({
                prerequisites: [
                  { label: IP_LABEL, path: 'ip' },
                  { label: SERIES_LABEL, path: 'series' },
                ],
              }),
            },
          },
          filterOptions: ({ siblingData }) => {
            const seriesId = relId((siblingData as { series?: unknown } | undefined)?.series)
            // 没选系列时不列全量子系列；选了系列就只列它的子系列，下拉不会堆无关数据。
            return seriesId ? { series: { equals: seriesId } } : false
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
          label: { zh: '编号', en: 'Code', ja: 'コレクション番号' },
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
        {
          name: 'stopBuyback',
          label: { zh: '停止买取', en: 'Buyback stopped', ja: '買取停止' },
          type: 'checkbox',
          defaultValue: false,
          index: true,
          admin: {
            width: '33%',
            description: {
              zh: '与「高价买取」「不减额买取」互斥；勾选后可以不填卖价，前台显示「停止买取」',
              en: 'Mutually exclusive with "High-value buyback" and "No-deduction buyback"; skips the price and shows "Buyback stopped" on the site',
              ja: '「高価買取」「減額なし買取」と排他。価格は省略可、サイト側は「買取停止」と表示',
            },
            components: { Field: '@/components/admin/ExclusiveBuybackField#ExclusiveBuybackField' },
          },
        },
      ],
    },
    {
      name: 'images',
      label: { zh: '卡牌图片', en: 'Images', ja: '画像' },
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      // 选图要能看见缩略图：select 模式只渲染 alt 文本，drawer 打开媒体列表并带预览。
      admin: { appearance: 'drawer' },
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
          admin: {
            width: '33%',
            description: { zh: '与「不减额买取」「停止买取」互斥；进入首页高价买取栏目', en: 'Mutually exclusive with "No-deduction buyback" and "Buyback stopped"; appears in the homepage strip', ja: '「減額なし買取」「買取停止」と排他。トップの高価買取欄に表示' },
            components: { Field: '@/components/admin/ExclusiveBuybackField#ExclusiveBuybackField' },
          },
        },
        {
          name: 'isNoDeduction',
          label: { zh: '不减额买取', en: 'No-deduction buyback', ja: '減額なし買取' },
          type: 'checkbox',
          defaultValue: false,
          index: true,
          admin: {
            width: '33%',
            description: { zh: '与「高价买取」「停止买取」互斥；进入首页高价买取栏目', en: 'Mutually exclusive with "High-value buyback" and "Buyback stopped"; appears in the homepage strip', ja: '「高価買取」「買取停止」と排他。トップの高価買取欄に表示' },
            components: { Field: '@/components/admin/ExclusiveBuybackField#ExclusiveBuybackField' },
          },
        },
        {
          name: 'cardStatus',
          label: { zh: '卡牌状态', en: 'Card condition', ja: 'カード状態' },
          type: 'relationship',
          relationTo: 'card-statuses',
          required: true,
          index: true,
          admin: { width: '33%' },
        },
      ],
    },
    {
      ...sortField(),
      defaultValue: 0,
      index: true,
      admin: { hidden: true },
    },
    statusField(),
    linkField(),
  ],
}
