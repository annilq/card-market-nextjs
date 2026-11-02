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
  ],
}
