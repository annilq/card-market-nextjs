/**
 * 卡牌状态（后台 `card-statuses`）徽章配色。
 *
 * 颜色是后台的显式字段（`color`），不再按名称猜：运营新增「PSA10」「裸卡」
 * 以外的状态时，直接在卡牌状态里选一个颜色即可，改名也不会改变徽章。
 *
 * 颜色用语义值存库（red / blue / …），具体色值落在 `globals.css` 的
 * `--color-status-*` 令牌上；这样浅色 / 深色主题可以在样式层统一调整，
 * 组件与数据库都只认语义名。
 *
 * 未知值（例如历史数据或以后删掉的预设）回落到品牌红，避免徽章变成透明。
 */
export type CardStatusColor = 'red' | 'blue' | 'green' | 'amber' | 'violet' | 'slate'

/** 后台 `card-statuses.color` 的可选预设。标签随 Payload 的 i18n 走。 */
export const CARD_STATUS_COLOR_OPTIONS: {
  value: CardStatusColor
  label: { zh: string; en: string; ja: string }
}[] = [
  { value: 'red', label: { zh: '红色', en: 'Red', ja: '赤' } },
  { value: 'blue', label: { zh: '蓝色', en: 'Blue', ja: '青' } },
  { value: 'green', label: { zh: '绿色', en: 'Green', ja: '緑' } },
  { value: 'amber', label: { zh: '琥珀色', en: 'Amber', ja: '琥珀色' } },
  { value: 'violet', label: { zh: '紫色', en: 'Violet', ja: '紫' } },
  { value: 'slate', label: { zh: '灰色', en: 'Slate', ja: 'グレー' } },
]

const BADGE_CLASS: Record<CardStatusColor, string> = {
  red: 'bg-status-red text-white',
  blue: 'bg-status-blue text-white',
  green: 'bg-status-green text-white',
  amber: 'bg-status-amber text-white',
  violet: 'bg-status-violet text-white',
  slate: 'bg-status-slate text-white',
}

/** 状态色值 → 徽章类名。所有卡位共用一套，避免同一状态在两处显示成两种颜色。 */
export function statusBadgeClass(color: string | null | undefined): string {
  return BADGE_CLASS[(color ?? '') as CardStatusColor] ?? 'bg-brand text-white'
}
