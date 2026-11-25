import type { AdminMessageKey, AdminT } from '@/lib/admin/i18n'

import type { CardDraft } from './batch-state'

export type CardDraftErrors = Partial<Record<keyof CardDraft, string>>

const TAXONOMY_FIELDS = [
  ['ipId', 'bulk.error.ip'],
  ['seriesId', 'bulk.error.series'],
  ['subSeriesId', 'bulk.error.subSeries'],
  ['rarityId', 'bulk.error.rarity'],
  ['cardStatusId', 'bulk.error.cardStatus'],
] as const satisfies readonly (readonly [keyof CardDraft, AdminMessageKey])[]

export function validateCardDraft(draft: CardDraft, t: AdminT): CardDraftErrors {
  const errors: CardDraftErrors = {}

  if (!draft.alt.trim()) errors.alt = t('bulk.error.alt')
  if (!draft.name.trim()) errors.name = t('bulk.error.name')

  for (const [field, key] of TAXONOMY_FIELDS) {
    if (draft[field] == null) errors[field] = t(key)
  }

  if (!draft.stopBuyback && !draft.price.trim()) {
    errors.price = t('bulk.error.price')
  } else if (draft.price.trim()) {
    const price = Number(draft.price)
    if (!Number.isFinite(price) || price < 0) errors.price = t('bulk.error.priceNumber')
  }

  return errors
}

export function hasDraftErrors(errors: CardDraftErrors): boolean {
  return Object.keys(errors).length > 0
}
