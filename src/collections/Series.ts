import type { CollectionConfig } from 'payload'

import { enabledOnly, isAdmin } from '@/access'
import { enabledField, sortField } from '@/fields/shared'
import { revalidateHook } from '@/lib/revalidate'

export const Series: CollectionConfig = {
  slug: 'series',
  labels: {
    singular: { zh: '系列', en: 'Series', ja: 'シリーズ' },
    plural: { zh: '系列', en: 'Series', ja: 'シリーズ' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'ip', 'sort', 'enabled'],
    group: { zh: '分类', en: 'Taxonomy', ja: '分類' },
  },
  access: { read: enabledOnly, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: {
    // 维度（系列）变动 → 筛选维度缓存立即失效。
    afterChange: [revalidateHook('facets')],
    afterDelete: [revalidateHook('facets')],
  },
  fields: [
    { name: 'name', label: { zh: '名称', en: 'Name', ja: '名称' }, type: 'text', required: true, index: true },
    {
      name: 'ip',
      label: { zh: '所属 IP', en: 'IP', ja: 'IP' },
      type: 'relationship',
      relationTo: 'ips',
      required: true,
      index: true,
    },
    sortField(),
    enabledField(),
  ],
}
