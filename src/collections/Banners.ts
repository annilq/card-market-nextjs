import type { CollectionConfig } from 'payload'

import { isAdmin, publishedOnly } from '@/access'
import { sortField, statusField } from '@/fields/shared'

export const Banners: CollectionConfig = {
  slug: 'banners',
  labels: {
    singular: { zh: '首页轮播', en: 'Banner', ja: 'バナー' },
    plural: { zh: '首页轮播（单槽位）', en: 'Banners (home carousel)', ja: 'バナー（トップ carousel）' },
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'sort', 'status'],
    group: { zh: '内容', en: 'Content', ja: 'コンテンツ' },
    description: {
      zh: '单槽位：仅首页顶部轮播，无定时上下线，轮播间隔由前端常量控制。',
      en: 'Single slot for the home carousel. No scheduling; interval is a frontend constant.',
      ja: 'トップ carousel の単一スロット。スケジュール設定はなし。',
    },
  },
  access: { read: publishedOnly, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    { name: 'title', label: { zh: '标题', en: 'Title', ja: 'タイトル' }, type: 'text' },
    { name: 'description', label: { zh: '描述', en: 'Description', ja: '説明' }, type: 'textarea' },
    {
      name: 'image',
      label: { zh: '轮播图', en: 'Image', ja: '画像' },
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'link',
      label: { zh: '跳转链接', en: 'Link', ja: 'リンク' },
      type: 'text',
      admin: { description: { zh: '站内路径（如 /cards）或外部 URL', en: 'Internal path (e.g. /cards) or external URL', ja: '内部パス（例 /cards）または外部 URL' } },
    },
    sortField(),
    statusField({ defaultValue: 'draft' }),
  ],
}
