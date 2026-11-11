import type { CardDraft } from './batch-state'

export type CardDraftErrors = Partial<Record<keyof CardDraft, string>>

const TAXONOMY_FIELDS = [
  ['ipId', '请选择 IP / 大类'],
  ['seriesId', '请选择系列'],
  ['subSeriesId', '请选择子系列'],
  ['rarityId', '请选择稀有程度'],
  ['cardStatusId', '请选择卡牌状态'],
] as const

export function validateCardDraft(draft: CardDraft): CardDraftErrors {
  const errors: CardDraftErrors = {}

  if (!draft.alt.trim()) errors.alt = '请填写替代文本'
  if (!draft.name.trim()) errors.name = '请填写卡牌名称'

  for (const [field, message] of TAXONOMY_FIELDS) {
    if (draft[field] == null) errors[field] = message
  }

  if (draft.price.trim()) {
    const price = Number(draft.price)
    if (!Number.isFinite(price) || price < 0) errors.price = '卖价必须是不小于 0 的数字'
  }

  return errors
}

export function hasDraftErrors(errors: CardDraftErrors): boolean {
  return Object.keys(errors).length > 0
}
