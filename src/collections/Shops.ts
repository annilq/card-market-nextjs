import type { CollectionConfig } from 'payload'

import { isAdmin, publishedOnly } from '@/access'
import { linkField, sortField, statusField } from '@/fields/shared'
import { revalidateHook } from '@/lib/revalidate'

export const Shops: CollectionConfig = {
  slug: 'shops',
  labels: {
    singular: { zh: '门店', en: 'Shop', ja: '店舗' },
    plural: { zh: '门店', en: 'Shops', ja: '店舗' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'address', 'sort', 'status', 'publicLink'],
    group: { zh: '内容', en: 'Content', ja: 'コンテンツ' },
  },
  access: { read: publishedOnly, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: {
    beforeChange: [
      ({ data }) => {
        // 地图选点写 geo（{lat,lng}），此处镜像回 lat / lng
        // （Directus 版本是数据库触发器 trg_shops_sync_geo；Payload 直接用一个钩子搞定）
        const geo = data?.geo as { lat?: number; lng?: number } | null | undefined
        if (geo && typeof geo.lat === 'number' && typeof geo.lng === 'number') {
          data.lat = geo.lat
          data.lng = geo.lng
        }
        return data
      },
    ],
    // 门店变动 → 门店缓存立即失效。
    afterChange: [revalidateHook('shops')],
    afterDelete: [revalidateHook('shops')],
  },
  fields: [
    { name: 'name', label: { zh: '门店名称', en: 'Shop name', ja: '店舗名' }, type: 'text', required: true, index: true },
    { name: 'address', label: { zh: '地址', en: 'Address', ja: '住所' }, type: 'textarea' },
    {
      type: 'row',
      fields: [
        {
          name: 'geo',
          label: { zh: '位置（地图选点）', en: 'Location (map picker)', ja: '位置（地図で選択）' },
          type: 'json',
          admin: {
            width: '50%',
            components: { Field: '@/collections/Shops/MapPickerField#MapPickerField' },
            description: { zh: '在地图上点选或搜索地址，保存后自动写入纬度 / 经度', en: 'Pick on the map or search an address — lat/lng are synced on save', ja: '地図で選択または住所検索、保存時に緯度経度へ反映' },
          },
        },
        {
          name: 'businessHours',
          label: { zh: '营业时间', en: 'Business hours', ja: '営業時間' },
          type: 'text',
          admin: { width: '50%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'lat',
          label: { zh: '纬度', en: 'Latitude', ja: '緯度' },
          type: 'number',
          admin: { width: '25%', readOnly: true, description: { zh: '由地图选点自动写入', en: 'Auto-filled from map', ja: '地図から自動入力' } },
        },
        {
          name: 'lng',
          label: { zh: '经度', en: 'Longitude', ja: '経度' },
          type: 'number',
          admin: { width: '25%', readOnly: true, description: { zh: '由地图选点自动写入', en: 'Auto-filled from map', ja: '地図から自動入力' } },
        },
        {
          name: 'phone',
          label: { zh: '电话', en: 'Phone', ja: '電話' },
          type: 'text',
          admin: { width: '25%' },
        },
        {
          name: 'image',
          label: { zh: '门店图片', en: 'Photo', ja: '写真' },
          type: 'upload',
          relationTo: 'media',
          admin: { width: '25%' },
        },
      ],
    },
    { name: 'description', label: { zh: '门店介绍', en: 'Description', ja: '紹介' }, type: 'textarea' },
    sortField(),
    statusField({ defaultValue: 'published' }),
    linkField(),
  ],
}
