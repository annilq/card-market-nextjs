import type { SelectField } from 'payload'

/** 内容集合统一的三态生命周期（对齐 Directus 内置 status：草稿 / 已发布 / 已归档）。 */
export const STATUS_OPTIONS = [
  { label: { zh: '草稿', en: 'Draft', ja: '下書き' }, value: 'draft' },
  { label: { zh: '已发布', en: 'Published', ja: '公開' }, value: 'published' },
  { label: { zh: '已归档', en: 'Archived', ja: 'アーカイブ' }, value: 'archived' },
] as SelectField['options']

export function statusField(overrides: Partial<SelectField> = {}): SelectField {
  const field = {
    name: 'status',
    label: { zh: '状态', en: 'Status', ja: 'ステータス' },
    type: 'select',
    options: STATUS_OPTIONS,
    defaultValue: 'draft',
    required: true,
    index: true,
    admin: {
      position: 'sidebar',
      // 列表里显示成一枚语义色胶囊（绿 / 琥珀 / 中性），见 StatusCell 的注释。
      // 只影响列表单元格，表单里仍是 Payload 自己的下拉。
      components: { Cell: '@/components/admin/StatusCell#StatusCell' },
    },
    ...overrides,
  }
  return field as SelectField
}

/** 维度集合（IP / 系列 / 子系列 / 稀有度）用布尔「启用」而非发布状态。 */
export function enabledField() {
  return {
    name: 'enabled',
    label: { zh: '启用', en: 'Enabled', ja: '有効' },
    type: 'checkbox' as const,
    defaultValue: true,
    admin: { position: 'sidebar' as const },
  }
}

export function sortField() {
  return {
    name: 'sort',
    label: { zh: '排序', en: 'Sort', ja: '並び順' },
    type: 'number' as const,
    defaultValue: 0,
    admin: { position: 'sidebar' as const },
  }
}

/**
 * 列表里的「链接」列：展示当前条目的前台路径，点击展开并可复制。
 *
 * 不是数据库字段（type: 'ui'），列里显示什么由 LinkCell 按集合拼出来，
 * 拼链接的规则在 src/lib/admin/public-links.ts。加这列是为了运营能直接
 * 拿到详情页地址，填进 banner 的跳转链接，不用自己拼 id。
 */
export function linkField() {
  return {
    name: 'publicLink',
    label: { zh: '链接', en: 'Link', ja: 'リンク' },
    type: 'ui' as const,
    admin: {
      components: { Cell: '@/components/admin/LinkCell#LinkCell' },
      width: '220px',
    },
  }
}
