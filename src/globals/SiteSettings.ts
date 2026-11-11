import type { GlobalConfig } from 'payload'

import { roleAction } from '@/access/roles'
import { revalidateGlobalHook } from '@/lib/revalidate'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: { zh: '站点设置', en: 'Site settings', ja: 'サイト設定' },
  admin: { group: { zh: '设置', en: 'Settings', ja: '設定' } },
  // 读取保持公开（前台每个页面布局都用它）；编辑按角色控制（管理员或拥有 site-settings 编辑权限的角色）。
  access: {
    read: () => true,
    update: roleAction('site-settings', 'update'),
  },
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
    { name: 'xAccount', label: { zh: 'X 账号', en: 'X account', ja: 'X アカウント' }, type: 'text' },
    // 前台不读取这些字段，同类信息在 info-pages 与 shops 集合；保留字段避免丢数据，只隐藏表单入口。
    { name: 'contactEmail', label: { zh: '联系邮箱', en: 'Contact email', ja: '連絡先メール' }, type: 'email', admin: { hidden: true } },
    { name: 'contactPhone', label: { zh: '联系电话', en: 'Contact phone', ja: '電話番号' }, type: 'text', admin: { hidden: true } },
    { name: 'businessHours', label: { zh: '营业时间', en: 'Business hours', ja: '営業時間' }, type: 'text', admin: { hidden: true } },
    { name: 'shopAddress', label: { zh: '门店地址（总）', en: 'Shop address', ja: '店舗住所' }, type: 'textarea', admin: { hidden: true } },
    { name: 'dataNotice', label: { zh: '数据说明', en: 'Data notice', ja: 'データに関する注記' }, type: 'richText', admin: { hidden: true } },
    { name: 'privacyPolicy', label: { zh: '隐私政策', en: 'Privacy policy', ja: 'プライバシーポリシー' }, type: 'richText', admin: { hidden: true } },
  ],
}
