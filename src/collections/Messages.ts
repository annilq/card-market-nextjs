import { APIError, type CollectionConfig } from 'payload'

import { adminOnlyField, isAdmin } from '@/access'

const MESSAGE_STATUS = [
  { label: { zh: '新', en: 'New', ja: '新規' }, value: 'new' },
  { label: { zh: '已处理', en: 'Processed', ja: '処理済み' }, value: 'processed' },
  { label: { zh: '已归档', en: 'Archived', ja: 'アーカイブ' }, value: 'archived' },
  { label: { zh: '已标记垃圾', en: 'Spam', ja: 'スパム' }, value: 'spam' },
]

export const Messages: CollectionConfig = {
  slug: 'messages',
  labels: {
    singular: { zh: '访客留言', en: 'Message', ja: 'お問い合わせ' },
    plural: { zh: '访客留言', en: 'Messages', ja: 'お問い合わせ' },
  },
  admin: {
    useAsTitle: 'content',
    defaultColumns: ['content', 'contactName', 'card', 'status', 'createdAt'],
    group: { zh: '内容', en: 'Content', ja: 'コンテンツ' },
    description: {
      zh: '工单式生命周期（新 / 已处理 / 已归档 / 已标记垃圾），刻意不使用内容集合的发布状态。',
      en: 'Ticket-style lifecycle, intentionally not using the content publish status.',
      ja: 'チケット形式のライフサイクル（コンテンツの公開ステータスは使わない）。',
    },
  },
  access: {
    // 公开可写、公开不可读（对齐 Directus Public 角色的字段级 create 权限）
    read: ({ req }) => Boolean(req.user),
    create: () => true,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        // 未登录（访客）提交：只保留允许字段，状态强制为「新」
        if (!req.user) {
          const content = (data?.content ?? '').toString().trim()
          if (!content) throw new APIError('留言内容不能为空', 400, { field: 'content' }, true)
          if (content.length > 2000) throw new APIError('留言内容过长', 400, { field: 'content' }, true)
          return {
            content,
            contactName: (data?.contactName ?? '').toString().trim().slice(0, 120) || null,
            contactInfo: (data?.contactInfo ?? '').toString().trim().slice(0, 200) || null,
            card: data?.card ?? null,
            status: 'new',
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'content',
      label: { zh: '留言内容', en: 'Message', ja: 'お問い合わせ内容' },
      type: 'textarea',
      required: true,
      maxLength: 2000,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'contactName',
          label: { zh: '联系人', en: 'Name', ja: 'お名前' },
          type: 'text',
          admin: { width: '50%' },
        },
        {
          name: 'contactInfo',
          label: { zh: '联系方式', en: 'Contact', ja: '連絡先' },
          type: 'text',
          admin: { width: '50%', description: { zh: '邮箱 / 电话 / 微信，选填', en: 'Email / phone / WeChat (optional)', ja: 'メール / 電話 / WeChat（任意）' } },
        },
      ],
    },
    {
      name: 'card',
      label: { zh: '关联卡牌', en: 'Related card', ja: '関連カード' },
      type: 'relationship',
      relationTo: 'cards',
      admin: { description: { zh: '访客从卡牌详情「咨询此卡」进入时带入', en: 'Prefilled when the visitor asks about a card', ja: 'カード詳細の「このカードについて問い合わせる」から自動入力' } },
    },
    {
      name: 'status',
      label: { zh: '处理状态', en: 'Status', ja: 'ステータス' },
      type: 'select',
      options: MESSAGE_STATUS,
      defaultValue: 'new',
      required: true,
      index: true,
      access: { update: adminOnlyField },
      admin: {
        position: 'sidebar',
        // 列表里显示成语义色胶囊：这是团队每天排的队，「新」必须一眼可见。
        // 工单的四态和内容集合的三态共用 StatusCell，颜色语义见它的注释。
        components: { Cell: '@/components/admin/StatusCell#StatusCell' },
      },
    },
  ],
}
