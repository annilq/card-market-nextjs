import type { CollectionConfig } from 'payload'

import { isAdmin, publishedAnnouncementOnly } from '@/access'
import { sortField, statusField } from '@/fields/shared'
import { revalidateHook } from '@/lib/revalidate'

export const Announcements: CollectionConfig = {
  slug: 'announcements',
  labels: {
    singular: { zh: '公告', en: 'Announcement', ja: 'お知らせ' },
    plural: { zh: '公告', en: 'Announcements', ja: 'お知らせ' },
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'isPinned', 'publishedAt', 'status'],
    group: { zh: '内容', en: 'Content', ja: 'コンテンツ' },
    description: {
      zh: '前台可见 = 已发布 且 (发布时间为空 或 已到点)；排序：置顶优先，其次发布时间倒序。',
      en: 'Visible when published and (publishedAt is empty or in the past). Pinned first, then newest.',
      ja: '公開条件：公開ステータス かつ 公開日時が空または過去。固定記事が先。',
    },
  },
  access: {
    read: publishedAnnouncementOnly,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    // 公告变动 → 公告缓存立即失效。
    afterChange: [revalidateHook('announcements')],
    afterDelete: [revalidateHook('announcements')],
  },
  fields: [
    { name: 'title', label: { zh: '标题', en: 'Title', ja: 'タイトル' }, type: 'text', required: true, index: true },
    { name: 'body', label: { zh: '正文', en: 'Body', ja: '本文' }, type: 'richText' },
    {
      type: 'row',
      fields: [
        {
          name: 'publishedAt',
          label: { zh: '发布时间', en: 'Publish at', ja: '公開日時' },
          type: 'date',
          index: true,
          admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' }, description: { zh: '留空 = 立即展示；未来时间 = 定时发布', en: 'Empty = show now; future = scheduled', ja: '空 = すぐ表示 / 未来 = 予約投稿' } },
        },
        {
          name: 'isPinned',
          label: { zh: '置顶', en: 'Pinned', ja: '固定表示' },
          type: 'checkbox',
          defaultValue: false,
          index: true,
          admin: { width: '50%' },
        },
      ],
    },
    sortField(),
    statusField({ defaultValue: 'draft' }),
  ],
}
