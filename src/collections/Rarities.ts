import type { CollectionConfig } from 'payload'

import { enabledOnly, isAdmin } from '@/access'
import { enabledField, sortField } from '@/fields/shared'

export const Rarities: CollectionConfig = {
  slug: 'rarities',
  labels: {
    singular: { zh: '稀有程度', en: 'Rarity', ja: 'レアリティ' },
    plural: { zh: '稀有程度', en: 'Rarities', ja: 'レアリティ' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'sort', 'enabled'],
    group: { zh: '分类', en: 'Taxonomy', ja: '分類' },
  },
  access: { read: enabledOnly, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    { name: 'name', label: { zh: '名称', en: 'Name', ja: '名称' }, type: 'text', required: true, index: true },
    sortField(),
    enabledField(),
  ],
}
