import type { CollectionConfig } from 'payload'

import { enabledOnly } from '@/access'
import { moduleRead, roleAction } from '@/access/roles'
import { enabledField, sortField } from '@/fields/shared'
import { CARD_STATUS_COLOR_OPTIONS } from '@/lib/card-status'
import { revalidateHook } from '@/lib/revalidate'

export const CardStatuses: CollectionConfig = {
  slug: 'card-statuses',
  labels: {
    singular: { zh: '卡牌状态', en: 'Card condition', ja: 'カード状態' },
    plural: { zh: '卡牌状态', en: 'Card conditions', ja: 'カード状態' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'sort', 'enabled', 'color'],
    group: { zh: '分类', en: 'Taxonomy', ja: '分類' },
  },
  access: {
    read: moduleRead('card-statuses', enabledOnly),
    create: roleAction('card-statuses', 'create'),
    update: roleAction('card-statuses', 'update'),
    delete: roleAction('card-statuses', 'delete'),
  },
  hooks: {
    // 维度（卡牌状态）变动 → 筛选维度缓存与卡牌列表缓存（徽章颜色烘在 CardView 里）立即失效。
    afterChange: [revalidateHook('facets', 'cards')],
    afterDelete: [revalidateHook('facets', 'cards')],
  },
  fields: [
    { name: 'name', label: { zh: '名称', en: 'Name', ja: '名称' }, type: 'text', required: true, index: true },
    sortField(),
    enabledField(),
    {
      name: 'color',
      label: { zh: '颜色', en: 'Color', ja: '色' },
      type: 'select',
      options: CARD_STATUS_COLOR_OPTIONS,
      defaultValue: 'red',
      required: true,
      admin: {
        description: {
          zh: '前台卡牌状态徽章的底色。新增状态时选一个预设即可，改名不会影响颜色。',
          en: 'Badge color for this condition on the storefront. Pick a preset when adding a status; renaming does not change the color.',
          ja: 'ストアのカード状態バッジの背景色。新しい状態を追加するときにプリセットを選んでください。名前を変えても色は変わりません。',
        },
      },
    },
  ],
}
