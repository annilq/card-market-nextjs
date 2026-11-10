import type { CollectionConfig } from 'payload'

import { enabledOnly } from '@/access'
import { moduleRead, roleAction } from '@/access/roles'
import { enabledField, sortField } from '@/fields/shared'
import { revalidateHook } from '@/lib/revalidate'

export const CardStatuses: CollectionConfig = {
  slug: 'card-statuses',
  labels: {
    singular: { zh: '卡牌状态', en: 'Card condition', ja: 'カード状態' },
    plural: { zh: '卡牌状态', en: 'Card conditions', ja: 'カード状態' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'sort', 'enabled', 'accent'],
    group: { zh: '分类', en: 'Taxonomy', ja: '分類' },
  },
  access: {
    read: moduleRead('card-statuses', enabledOnly),
    create: roleAction('card-statuses', 'create'),
    update: roleAction('card-statuses', 'update'),
    delete: roleAction('card-statuses', 'delete'),
  },
  hooks: {
    // 维度（卡牌状态）变动 → 筛选维度缓存立即失效。
    afterChange: [revalidateHook('facets')],
    afterDelete: [revalidateHook('facets')],
  },
  fields: [
    { name: 'name', label: { zh: '名称', en: 'Name', ja: '名称' }, type: 'text', required: true, index: true },
    sortField(),
    enabledField(),
    {
      name: 'accent',
      label: { zh: '高亮标识', en: 'Highlight', ja: '強調表示' },
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: {
          zh: '勾选后，属于该状态的卡牌在前台显示强调样式（原来「有包装」卡的特殊标识）。',
          en: 'Cards in this condition get the accent styling previously used for packaged cards.',
          ja: 'この状態のカードに、従来「パッケージあり」に使っていた強調表示を付けます。',
        },
      },
    },
  ],
}
