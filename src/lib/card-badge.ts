import type { CardView } from './types'

export type BuybackBadge = { label: 'highValue' | 'noDeduction' | 'stopBuyback'; className: string }

export function buybackBadge(card: CardView): BuybackBadge | null {
  if (card.stopBuyback) {
    return { label: 'stopBuyback', className: 'bg-muted-foreground' }
  }
  if (card.isNoDeduction) {
    return { label: 'noDeduction', className: 'bg-[#1D71DB]' }
  }
  if (card.isHighValue) {
    return { label: 'highValue', className: 'bg-brand' }
  }
  return null
}
