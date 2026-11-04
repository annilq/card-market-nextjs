import type { GlobalConfig } from 'payload'

import { revalidateGlobalHook } from '@/lib/revalidate'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: { zh: '站点设置', en: 'Site settings', ja: 'サイト設定' },
  admin: { group: { zh: '设置', en: 'Settings', ja: '設定' } },
  access: { read: () => true },
  hooks: {
    // 站点设置变动 → 站点设置缓存立即失效（每个页面布局都用它）。
    afterChange: [revalidateGlobalHook('site-settings')],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'siteName',
          label: { zh: '站点名称', en: 'Site name', ja: 'サイト名' },
          type: 'text',
          required: true,
          defaultValue: '卡牌回购站',
          admin: { width: '50%' },
        },
        {
          name: 'logo',
          label: { zh: '站点 Logo', en: 'Logo', ja: 'ロゴ' },
          type: 'upload',
          relationTo: 'media',
          admin: { width: '50%' },
        },
      ],
    },
    { name: 'intro', label: { zh: '站点简介', en: 'Intro', ja: '紹介文' }, type: 'textarea' },
    {
      type: 'row',
      fields: [
        { name: 'xAccount', label: { zh: 'X 账号', en: 'X account', ja: 'X アカウント' }, type: 'text', admin: { width: '50%' } },
        { name: 'contactEmail', label: { zh: '联系邮箱', en: 'Contact email', ja: '連絡先メール' }, type: 'email', admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'contactPhone', label: { zh: '联系电话', en: 'Contact phone', ja: '電話番号' }, type: 'text', admin: { width: '50%' } },
        { name: 'businessHours', label: { zh: '营业时间', en: 'Business hours', ja: '営業時間' }, type: 'text', admin: { width: '50%' } },
      ],
    },
    { name: 'shopAddress', label: { zh: '门店地址（总）', en: 'Shop address', ja: '店舗住所' }, type: 'textarea' },
    { name: 'dataNotice', label: { zh: '数据说明', en: 'Data notice', ja: 'データに関する注記' }, type: 'richText' },
    { name: 'privacyPolicy', label: { zh: '隐私政策', en: 'Privacy policy', ja: 'プライバシーポリシー' }, type: 'richText' },
  ],
}
