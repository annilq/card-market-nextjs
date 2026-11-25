import type { AdminT } from '@/lib/admin/i18n'

import type { CardDraft, MediaRef, SaveField } from './batch-state'

export class CardSaveError extends Error {
  readonly field?: SaveField

  constructor(message: string, field?: SaveField) {
    super(message)
    this.name = 'CardSaveError'
    this.field = field
  }
}

type LexicalText = {
  mode: 'normal'
  text: string
  type: 'text'
  style: ''
  detail: 0
  format: 0
  version: 1
}

type LexicalParagraph = {
  type: 'paragraph'
  format: ''
  indent: 0
  version: 1
  children: LexicalText[]
  direction: 'ltr'
}

type LexicalRoot = {
  root: {
    type: 'root'
    format: ''
    indent: 0
    version: 1
    children: LexicalParagraph[]
    direction: 'ltr'
  }
}

function toLexical(text: string): LexicalRoot {
  const lines = text.split(/\r?\n/)
  while (lines.length > 0 && !lines[lines.length - 1].trim()) lines.pop()

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: lines.map((line) => ({
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: line
          ? [
              {
                mode: 'normal',
                text: line,
                type: 'text',
                style: '',
                detail: 0,
                format: 0,
                version: 1,
              },
            ]
          : [],
      })),
    },
  }
}

export type CardPayload = {
  name: string
  ip: number
  series: number
  subSeries: number
  rarity: number
  cardStatus: number
  images: number[]
  status: CardDraft['status']
  isHighValue: boolean
  isNoDeduction: boolean
  stopBuyback: boolean
  code?: string
  price?: number
  description?: LexicalRoot
}

export function toCardPayload(draft: CardDraft, mediaId: number): CardPayload {
  const description = draft.description.trim()
  return {
    name: draft.name.trim(),
    ip: draft.ipId as number,
    series: draft.seriesId as number,
    subSeries: draft.subSeriesId as number,
    rarity: draft.rarityId as number,
    cardStatus: draft.cardStatusId as number,
    images: [mediaId],
    status: draft.status,
    isHighValue: draft.isHighValue,
    isNoDeduction: draft.isNoDeduction,
    stopBuyback: draft.stopBuyback,
    ...(draft.code.trim() ? { code: draft.code.trim() } : {}),
    ...(draft.price.trim() ? { price: Number(draft.price) } : {}),
    ...(description ? { description: toLexical(description) } : {}),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function messageFromBody(body: unknown, fallback: string, separator: string): string {
  if (!isRecord(body)) return fallback
  const errors = body.errors
  if (Array.isArray(errors)) {
    const messages = errors
      .map((error) => (isRecord(error) && typeof error.message === 'string' ? error.message : null))
      .filter((message): message is string => Boolean(message))
    if (messages.length > 0) return messages.join(separator)
  }
  return fallback
}

const DUPLICATE_CODE_MARKERS = ['编号已存在', '品番が既に存在します', 'code already exists']

function guessField(message: string, fallback: SaveField): SaveField {
  // 卡片的唯一键在服务端报错，前端只能按文案把错误落回「编号」字段。
  if (DUPLICATE_CODE_MARKERS.some((marker) => message.includes(marker))) return 'code'
  return fallback
}

async function failure(
  response: Response,
  fallback: string,
  field: SaveField,
  t: AdminT,
): Promise<CardSaveError> {
  if (response.status === 401 || response.status === 403) {
    return new CardSaveError(t('bulk.err.auth'), field)
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = null
  }
  const message = messageFromBody(
    body,
    t('bulk.err.http', { fallback, status: response.status }),
    t('bulk.err.listSeparator'),
  )
  return new CardSaveError(message, guessField(message, field))
}

async function updateMediaAlt(
  media: MediaRef,
  alt: string,
  apiRoute: string,
  t: AdminT,
): Promise<void> {
  if (alt === media.alt) return

  let response: Response
  try {
    response = await fetch(`${apiRoute}/media/${media.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alt }),
    })
  } catch {
    throw new CardSaveError(t('bulk.err.altNetwork'), 'media')
  }

  if (!response.ok) {
    throw await failure(response, t('bulk.err.altFailed'), 'media', t)
  }
}

export async function saveCard(args: {
  apiRoute: string
  draft: CardDraft
  media: MediaRef
  existingCardId?: number
  t: AdminT
}): Promise<number> {
  const { apiRoute, draft, media, existingCardId, t } = args
  const alt = draft.alt.trim()
  const action =
    existingCardId != null ? t('bulk.err.updateFailed') : t('bulk.err.saveFailed')

  await updateMediaAlt(media, alt, apiRoute, t)

  let response: Response
  try {
    response = await fetch(
      existingCardId != null ? `${apiRoute}/cards/${existingCardId}` : `${apiRoute}/cards`,
      {
        method: existingCardId != null ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toCardPayload(draft, media.id)),
      },
    )
  } catch {
    throw new CardSaveError(t('bulk.err.checkNetwork', { action }), 'card')
  }

  if (!response.ok) throw await failure(response, action, 'card', t)

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new CardSaveError(t('bulk.err.saveBadResponse'), 'card')
  }

  const doc = isRecord(body) && isRecord(body.doc) ? body.doc : body
  if (!isRecord(doc) || (typeof doc.id !== 'number' && typeof doc.id !== 'string')) {
    throw new CardSaveError(t('bulk.err.saveBadResponse'), 'card')
  }

  return Number(doc.id)
}
