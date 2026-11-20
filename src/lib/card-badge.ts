import type { CardView } from './types'

export type BuybackBadge = { label: 'highValue' | 'noDeduction'; className: string }

/**
 * 图角徽章只表达买取等级：高价买取 / 不减额买取。
 * 停止买取不是等级，它只在价格位置以文字呈现——同一张卡上绝不再做图角或页头徽章，
 * 否则「停止买取」会出现两次。
 */
export function buybackBadge(card: CardView): BuybackBadge | null {
  if (card.isNoDeduction) {
    return { label: 'noDeduction', className: 'bg-[#1D71DB]' }
  }
  if (card.isHighValue) {
    return { label: 'highValue', className: 'bg-brand' }
  }
  return null
}
