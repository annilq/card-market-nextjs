import type { Access, CollectionConfig } from 'payload'

import { moduleRead, roleAction } from '@/access/roles'

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
    // 图片必须公开可读：前台所有页面都直接引用媒体 URL；
    // 匿名访客始终可读（保持公开站点图片不裂图），登录用户按角色控制。
    read: moduleRead('media', (() => true) as Access),
    // 媒体的新增 / 编辑 / 删除纳入角色权限矩阵。
    create: roleAction('media', 'create'),
    update: roleAction('media', 'update'),
    delete: roleAction('media', 'delete'),
  },
  upload: {
    mimeTypes: ['image/*'],
    focalPoint: true,
    // 原图重编码为 webp 降体积（不影响已生成的 imageSizes；imageSizes 如需同样压缩见各 size 的 formatOptions）
    formatOptions: { format: 'webp', options: { quality: 82 } },
    // thumb / card 只给宽度：sharp 在同时给出宽高时按 cover 居中裁切，
    // 竖版卡面（5:7）的上下一整条会被切掉。只给宽度即等比缩放，卡面完整。
    // banner 保持 1920×900：轮播图位本来就是固定横幅，裁切是有意的。
    imageSizes: [
      { name: 'thumb', width: 480 },
      { name: 'card', width: 800 },
      { name: 'banner', width: 1920, height: 900, position: 'centre' },
    ],
    // 媒体响应默认不带 Cache-Control，浏览器回访会重新下载（Lighthouse 实测约 66 KiB）。
    // 文件名按上传批次带 -1/-2 后缀，内容基本不变，给 30 天浏览器缓存；30 天也是
    // Lighthouse 判定「高效缓存」的下限。若后台原地替换同名文件，用户最多看到 30 天旧图。
    modifyResponseHeaders: ({ headers }) => {
      headers.set('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=86400')
      return headers
    },
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
