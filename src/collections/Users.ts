import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: { zh: '用户', en: 'User', ja: 'ユーザー' }, plural: { zh: '用户', en: 'Users', ja: 'ユーザー' } },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name'],
    group: { zh: '系统', en: 'System', ja: 'システム' },
  },
  auth: true,
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'name', type: 'text', label: { zh: '姓名', en: 'Name', ja: '名前' } },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      label: { zh: '头像', en: 'Avatar', ja: 'アイコン' },
      // 让运营能在「账户」页上传自己的头像；后台右上角的账户图标（admin.avatar）
      // 会优先显示这张图，加载失败再退回首字母 / 默认人形图标，绝不出现裂图。
    },
  ],
}
