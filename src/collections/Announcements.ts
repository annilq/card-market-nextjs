import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { publishedAnnouncementOnly } from '@/access'
import { moduleRead, roleAction } from '@/access/roles'
import { linkField, sortField, sortFieldLabel, statusField } from '@/fields/shared'
import { revalidateHook } from '@/lib/revalidate'

/**
 * 发布时补发布时间：运营通常只把状态切成「已发布」，不会特意再填一次时间。
 * 留空意味着「立即发布」，因此把发布瞬间写进 publishedAt——前台列表、详情页
 * 和排序都依赖这个字段，留空会让日期整行消失。
 *
 * 只在真正发布且没有时间时补：定时发布（未来时间）和已填写的过去时间都原样保留；
 * 草稿 / 归档不写，等状态切到已发布时再补。
 */
const setPublishTimeOnPublish: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const status = data.status ?? originalDoc?.status
  // 表单显式清空（null）也视为「没填」，按立即发布处理；字段未提交时沿用原值。
  const publishedAt =
    data.publishedAt !== undefined ? data.publishedAt : originalDoc?.publishedAt

  if (status === 'published' && !publishedAt) {
    data.publishedAt = new Date().toISOString()
  }

  return data
}

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
      zh: '前台可见 = 已发布 且 (发布时间为空或已到点)。发布时间留空时，发布瞬间自动填为当前时间。未置顶：只按发布时间倒序；置顶：可同时置顶多条，组内按「置顶排序」升序，再按发布时间倒序。首页最多显示 3 条：置顶优先（最多 3 条，按置顶排序），不足 3 条时按发布时间倒序补满，例如 3 条置顶 / 2 置顶 + 1 最新 / 1 置顶 + 2 最新 / 3 条最新。',
      en: 'Visible when published and (publishedAt is empty or in the past). Unpinned: newest first. Pinned: multiple allowed, ordered by pin order then newest. Home shows at most 3: pinned first (up to 3, by pin order), then newest-first to fill the rest (3 pinned / 2 pinned + 1 newest / 1 pinned + 2 newest / 3 newest).',
      ja: '公開条件：公開ステータス かつ 公開日時が空または過去。固定なし：公開日時の新しい順。固定あり：複数可、固定順→公開日時の新しい順。トップは最大3件：固定記事を優先（最大3件・固定順）、足りない分は公開日時の新しい順で埋めます（固定3件 / 固定2+最新1 / 固定1+最新2 / 最新3件）。',
    },
  },
  access: {
    read: moduleRead('announcements', publishedAnnouncementOnly),
    create: roleAction('announcements', 'create'),
    update: roleAction('announcements', 'update'),
    delete: roleAction('announcements', 'delete'),
  },
  hooks: {
    // 发布时若没填发布时间，自动写为当前时间；之后再按需触发缓存失效。
    beforeChange: [setPublishTimeOnPublish],
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
            description: {
              zh: '留空 = 发布时自动填为当前时间并立即展示；未来时间 = 定时发布',
              en: 'Empty = auto-fill with the publish time and show now; future = scheduled',
              ja: '空 = 公開時に現在時刻を自動設定してすぐ表示 / 未来 = 予約投稿',
            },
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
              zh: '可同时置顶多条；首页最多展示 3 条置顶（按置顶排序），不足 3 条时用最新公告补满。',
              en: 'Multiple pins allowed; home shows up to 3 pinned announcements (by pin order), filled with the newest when fewer.',
              ja: '複数固定できます。トップは固定記事を最大3件（固定順）表示し、足りない分は最新記事で埋めます。',
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
        components: {
          Label: sortFieldLabel({
            zh: '仅置顶公告生效。数字越小越靠前，用于多条置顶公告之间的先后；未置顶时按发布时间倒序，此字段不参与排序。',
            en: 'Only applies to pinned announcements. Lower numbers come first among pins; unpinned ones sort by publish time and ignore this field.',
            ja: '固定記事のみ有効。小さいほど固定内で上位。固定なしは公開日時順で、この値は使われません。',
          }),
        },
      },
    },
    statusField({ defaultValue: 'draft' }),
    linkField(),
  ],
}
