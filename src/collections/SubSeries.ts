import type { CollectionConfig } from 'payload'

import { enabledOnly, isAdmin } from '@/access'
import { enabledField, sortField } from '@/fields/shared'
import { revalidateHook } from '@/lib/revalidate'

export const SubSeries: CollectionConfig = {
  slug: 'sub-series',
  labels: {
    singular: { zh: '子系列', en: 'Sub-series', ja: 'サブシリーズ' },
    plural: { zh: '子系列', en: 'Sub-series', ja: 'サブシリーズ' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'series', 'sort', 'enabled'],
    group: { zh: '分类', en: 'Taxonomy', ja: '分類' },
    description: {
      zh: '子系列必填：只有两层的 IP 也要建空壳占位，否则组合唯一约束会因 SQL NULL 失效。',
      en: 'Required even for two-level IPs: NULL breaks the composite unique constraint.',
      ja: '2階層のIPでも必須（NULL は一意制約に参加しないため）。',
    },
  },
  access: { read: enabledOnly, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: {
    // 维度（子系列）变动 → 筛选维度缓存立即失效。
    afterChange: [revalidateHook('facets')],
    afterDelete: [revalidateHook('facets')],
  },
  fields: [
    { name: 'name', label: { zh: '名称', en: 'Name', ja: '名称' }, type: 'text', required: true, index: true },
    {
      name: 'series',
      label: { zh: '所属系列', en: 'Series', ja: 'シリーズ' },
      type: 'relationship',
      relationTo: 'series',
      required: true,
      index: true,
    },
    sortField(),
    enabledField(),
  ],
}
