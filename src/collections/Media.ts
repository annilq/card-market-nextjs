import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: { zh: '图片', en: 'Media', ja: '画像' },
    plural: { zh: '图片', en: 'Media', ja: '画像' },
  },
  admin: {
    useAsTitle: 'alt',
    defaultColumns: ['alt', 'filename', 'url'],
    group: { zh: '素材', en: 'Assets', ja: 'アセット' },
  },
  access: {
    // 图片必须公开可读：前台所有页面都直接引用 /media/<filename>
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  upload: {
    mimeTypes: ['image/*'],
    focalPoint: true,
    imageSizes: [
      { name: 'thumb', width: 480, height: 480, position: 'centre' },
      { name: 'card', width: 800, height: 800, position: 'centre' },
      { name: 'banner', width: 1920, height: 900, position: 'centre' },
    ],
  },
  fields: [
    {
      name: 'alt',
      label: { zh: '替代文本', en: 'Alt text', ja: '代替テキスト' },
      type: 'text',
      required: true,
    },
  ],
}
