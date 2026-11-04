import type { CollectionConfig } from 'payload'

import { enabledOnly, isAdmin } from '@/access'
import { enabledField, sortField } from '@/fields/shared'
import { revalidateHook } from '@/lib/revalidate'

export const Ips: CollectionConfig = {
  slug: 'ips',
  labels: {
    singular: { zh: 'IP / 大类', en: 'IP', ja: 'IP' },
    plural: { zh: 'IP / 大类', en: 'IPs', ja: 'IP' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'sort', 'enabled'],
    group: { zh: '分类', en: 'Taxonomy', ja: '分類' },
    description: { zh: '卡牌所属 IP / 大类，如宝可梦、游戏王、龙珠', en: 'Top-level franchise, e.g. Pokémon / Yu-Gi-Oh!', ja: 'IP（例：ポケモン / 遊戯王）' },
  },
  access: { read: enabledOnly, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: {
    // 维度（IP）变动 → 筛选维度缓存立即失效。
    afterChange: [revalidateHook('facets')],
    afterDelete: [revalidateHook('facets')],
  },
  fields: [
    { name: 'name', label: { zh: '名称', en: 'Name', ja: '名称' }, type: 'text', required: true, index: true },
    sortField(),
    enabledField(),
  ],
}
