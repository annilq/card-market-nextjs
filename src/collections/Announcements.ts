import type { CollectionConfig } from 'payload'

import { publishedAnnouncementOnly } from '@/access'
import { moduleRead, roleAction } from '@/access/roles'
import { linkField, sortField, statusField } from '@/fields/shared'
import { revalidateHook } from '@/lib/revalidate'

export const Announcements: CollectionConfig = {
  slug: 'announcements',
  labels: {
    singular: { zh: '公告', en: 'Announcement', ja: 'お知らせ' },
    plural: { zh: '公告', en: 'Announcements', ja: 'お知らせ' },
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'isPinned', 'sort', 'publishedAt', 'status', 'publicLink'],
    group: { zh: '内容', en: 'Content', ja: 'コンテンツ' },
    description: {
      zh: '前台可见 = 已发布 且 (发布时间为空 或 已到点)。未置顶：只按发布时间倒序；置顶：可同时置顶多条，组内按「置顶排序」升序，再按发布时间倒序。首页最多显示 5 条，其中置顶最多显示前 2 条。',
      en: 'Visible when published and (publishedAt is empty or in the past). Unpinned: newest first. Pinned: multiple allowed, ordered by pin order then newest. Home shows at most 5, including at most 2 pinned.',
      ja: '公開条件：公開ステータス かつ 公開日時が空または過去。固定なし：公開日時の新しい順。固定あり：複数可、固定順→公開日時の新しい順。トップは最大5件（固定は最大2件）。',
    },
  },
  access: {
    read: moduleRead('announcements', publishedAnnouncementOnly),
    create: roleAction('announcements', 'create'),
    update: roleAction('announcements', 'update'),
    delete: roleAction('announcements', 'delete'),
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
          admin: {
            width: '50%',
            date: { pickerAppearance: 'dayAndTime' },
            description: { zh: '留空 = 立即展示；未来时间 = 定时发布', en: 'Empty = show now; future = scheduled', ja: '空 = すぐ表示 / 未来 = 予約投稿' },
            components: { Cell: '@/components/admin/AdminDateCell#AdminDateCell' },
          },
        },
        {
          name: 'isPinned',
          label: { zh: '置顶', en: 'Pinned', ja: '固定表示' },
          type: 'checkbox',
          defaultValue: false,
          index: true,
          admin: {
            width: '50%',
            description: {
              zh: '可同时置顶多条；首页只展示排序最靠前的 2 条置顶。',
              en: 'Multiple pins allowed; home shows only the top 2 by pin order.',
              ja: '複数固定できます。トップでは固定順の上位2件のみ表示。',
            },
          },
        },
      ],
    },
    // 置顶排序只在置顶时有意义：未置顶的公告一律按发布时间倒序，sort 被忽略。
    {
      ...sortField(),
      label: { zh: '置顶排序', en: 'Pin order', ja: '固定順' },
      admin: {
        position: 'sidebar',
        description: {
          zh: '数字越小越靠前，仅置顶公告生效；未置顶时无需填写。',
          en: 'Lower numbers come first. Only used for pinned announcements.',
          ja: '小さいほど上に表示。固定記事のみ有効。',
        },
        condition: (data) => Boolean(data?.isPinned),
      },
    },
    statusField({ defaultValue: 'draft' }),
    linkField(),
  ],
}
