import type { CollectionConfig } from 'payload'

import { enabledOnly } from '@/access'
import { moduleRead, roleAction } from '@/access/roles'
import { enabledField, sortField } from '@/fields/shared'
import { revalidateHook } from '@/lib/revalidate'

const IP_LABEL = { en: 'IP', ja: 'IP', zh: 'IP / 大类' }

const cascadingField = (clearPaths?: string[]) => ({
  clientProps: { cascade: { clearPaths } },
  path: '@/components/admin/TaxonomyCascadeField#CascadingRelationshipField',
})

const relId = (value: unknown): string | number | null => {
  if (!value) return null
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return (value as { id: string | number }).id
  }
  return value as string | number
}

export const SubSeries: CollectionConfig = {
  slug: 'sub-series',
  labels: {
    singular: { zh: '子系列', en: 'Sub-series', ja: 'サブシリーズ' },
    plural: { zh: '子系列', en: 'Sub-series', ja: 'サブシリーズ' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'series', 'sort', 'enabled'],
    group: { zh: '分类', en: 'Taxonomy', ja: '分類' },
    description: {
      zh: '子系列必填：只有两层的 IP 也要建空壳占位，否则组合唯一约束会因 SQL NULL 失效。',
      en: 'Required even for two-level IPs: NULL breaks the composite unique constraint.',
      ja: '2階層のIPでも必須（NULL は一意制約に参加しないため）。',
    },
  },
  access: {
    read: moduleRead('sub-series', enabledOnly),
    create: roleAction('sub-series', 'create'),
    update: roleAction('sub-series', 'update'),
    delete: roleAction('sub-series', 'delete'),
  },
  hooks: {
    // 维度（子系列）变动 → 筛选维度缓存立即失效。
    afterChange: [revalidateHook('facets')],
    afterDelete: [revalidateHook('facets')],
  },
  fields: [
    { name: 'name', label: { zh: '名称', en: 'Name', ja: '名称' }, type: 'text', required: true, index: true },
    {
      name: 'ip',
      label: IP_LABEL,
      type: 'relationship',
      relationTo: 'ips',
      required: true,
      index: true,
      admin: { components: { Field: cascadingField(['series']) } },
    },
    {
      name: 'series',
      label: { zh: '所属系列', en: 'Series', ja: 'シリーズ' },
      type: 'relationship',
      relationTo: 'series',
      required: true,
      index: true,
      filterOptions: ({ siblingData }) => {
        const ipId = relId((siblingData as { ip?: unknown } | undefined)?.ip)
        return ipId ? { ip: { equals: ipId } } : false
      },
    },
    sortField(),
    enabledField(),
  ],
}
