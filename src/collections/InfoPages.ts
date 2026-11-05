import type { CollectionConfig } from 'payload'

import { isAdmin, publishedOnly } from '@/access'
import { linkField, sortField, statusField } from '@/fields/shared'
import { revalidateHook } from '@/lib/revalidate'

/** 网站审核要求的四个固定信息页标识（前端清单与页脚入口共用）。 */
export const INFO_PAGE_KEYS = [
  { label: { zh: '运营信息', en: 'Operation info', ja: '運営情報' }, value: 'operation' },
  { label: { zh: '个人信息收集', en: 'Personal information', ja: '個人情報' }, value: 'personal-info' },
  { label: { zh: '利用规则', en: 'Terms', ja: '利用規約' }, value: 'terms' },
  { label: { zh: '数据使用', en: 'Data usage', ja: 'データ利用' }, value: 'data-usage' },
]

export const InfoPages: CollectionConfig = {
  slug: 'info-pages',
  labels: {
    singular: { zh: '信息页', en: 'Info page', ja: '情報ページ' },
    plural: { zh: '审核信息页', en: 'Info pages', ja: '情報ページ' },
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['pageKey', 'title', 'status', 'publicLink'],
    group: { zh: '内容', en: 'Content', ja: 'コンテンツ' },
    description: {
      zh: '四个固定信息页（运营信息 / 个人信息收集 / 利用规则 / 数据使用）。标识由前端登记，后台只维护标题与正文；未发布时前台仍 200 并提示「尚未发布」。',
      en: 'Four fixed compliance pages. Keys are registered in code; only title/body are editable.',
      ja: '4つの固定情報ページ。キーはコード側で固定、本文のみ管理。',
    },
  },
  access: { read: publishedOnly, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: {
    // 信息页变动 → 信息页缓存立即失效。
    afterChange: [revalidateHook('info-pages')],
    afterDelete: [revalidateHook('info-pages')],
  },
  fields: [
    {
      name: 'pageKey',
      label: { zh: '页面标识', en: 'Page key', ja: 'ページキー' },
      type: 'select',
      options: INFO_PAGE_KEYS,
      required: true,
      unique: true,
      index: true,
      admin: { description: { zh: '对应前台 /info/<标识>，不可随意修改', en: 'Maps to /info/<key>', ja: '/info/<key> に対応' } },
    },
    { name: 'title', label: { zh: '标题', en: 'Title', ja: 'タイトル' }, type: 'text', required: true },
    { name: 'body', label: { zh: '正文', en: 'Body', ja: '本文' }, type: 'richText' },
    sortField(),
    statusField({ defaultValue: 'draft' }),
    linkField(),
  ],
}
