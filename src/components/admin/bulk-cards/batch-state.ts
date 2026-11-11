export type TaxonomyOption = { id: number; name: string }

export type BulkCardsTaxonomy = {
  ips: TaxonomyOption[]
  series: (TaxonomyOption & { ipId: number })[]
  subSeries: (TaxonomyOption & { seriesId: number })[]
  rarities: TaxonomyOption[]
  cardStatuses: TaxonomyOption[]
}

export type MediaRef = {
  id: number
  alt: string
  filename: string
  url: string
  thumbUrl: string
  width: number
  height: number
}

export type UploadState =
  | { kind: 'queued' }
  | { kind: 'requesting' }
  | { kind: 'uploading'; sent: number; total: number }
  | { kind: 'processing' }
  | { kind: 'ready'; media: MediaRef }
  | { kind: 'failed'; phase: 'request' | 'upload' | 'create'; message: string }

export type CardDraft = {
  alt: string
  name: string
  ipId: number | null
  seriesId: number | null
  subSeriesId: number | null
  rarityId: number | null
  cardStatusId: number | null
  code: string
  price: string
  status: 'draft' | 'published' | 'archived'
  isHighValue: boolean
  description: string
}

export type SaveField = keyof CardDraft | 'card' | 'media'

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; cardId: number }
  | { kind: 'updating'; cardId: number }
  | { kind: 'failed'; message: string; field?: SaveField; cardId?: number }

/** 已经落到卡牌库的条目返回卡牌 id；更新失败也保留 id，便于继续重试。 */
export function savedCardId(save: SaveState): number | null {
  switch (save.kind) {
    case 'saved':
    case 'updating':
      return save.cardId
    case 'failed':
      return save.cardId ?? null
    default:
      return null
  }
}

export type BatchItem = {
  id: string
  file: File
  previewUrl: string
  draft: CardDraft
  upload: UploadState
  save: SaveState
  savedSnapshot: CardDraft | null
}

export type BatchState = { items: BatchItem[]; selectedId: string | null }

export function draftEquals(a: CardDraft, b: CardDraft): boolean {
  return (Object.keys(a) as (keyof CardDraft)[]).every((key) => a[key] === b[key])
}

/** 还没保存的条目算待处理；已保存的条目只有在表单被改过时才算有未保存修改。 */
export function isItemDirty(item: BatchItem): boolean {
  if (savedCardId(item.save) == null) return true
  return item.savedSnapshot != null && !draftEquals(item.draft, item.savedSnapshot)
}

export type BatchAction =
  | { type: 'files/add'; items: BatchItem[] }
  | {
      type: 'upload/phase'
      id: string
      phase: 'requesting' | 'uploading' | 'processing'
      total?: number
    }
  | { type: 'upload/progress'; id: string; sent: number; total: number }
  | { type: 'upload/ready'; id: string; media: MediaRef }
  | {
      type: 'upload/failed'
      id: string
      phase: 'request' | 'upload' | 'create'
      message: string
    }
  | { type: 'upload/retry'; id: string }
  | { type: 'item/select'; id: string }
  | { type: 'item/remove'; id: string }
  | { type: 'draft/change'; id: string; changes: Partial<CardDraft> }
  | { type: 'draft/bulk-change'; changes: Partial<CardDraft> }
  | { type: 'save/start'; id: string }
  | { type: 'save/succeeded'; id: string; cardId: number }
  | { type: 'save/failed'; id: string; message: string; field?: SaveField }

export function defaultAltFromFilename(name: string): string {
  const withoutExtension = name.replace(/\.[^.]+$/, '').trim()
  return withoutExtension || '未命名图片'
}

export function createCardDraft(alt: string): CardDraft {
  return {
    alt,
    name: '',
    ipId: null,
    seriesId: null,
    subSeriesId: null,
    rarityId: null,
    cardStatusId: null,
    code: '',
    price: '',
    status: 'draft',
    isHighValue: false,
    description: '',
  }
}

function updateItem(
  state: BatchState,
  id: string,
  update: (item: BatchItem) => BatchItem,
): BatchState {
  let changed = false
  const items = state.items.map((item) => {
    if (item.id !== id) return item
    const next = update(item)
    if (next !== item) changed = true
    return next
  })
  return changed ? { ...state, items } : state
}

function isInFlight(upload: UploadState): boolean {
  return upload.kind === 'requesting' || upload.kind === 'uploading' || upload.kind === 'processing'
}

export function batchReducer(state: BatchState, action: BatchAction): BatchState {
  switch (action.type) {
    case 'files/add': {
      if (action.items.length === 0) return state
      return {
        items: [...state.items, ...action.items],
        selectedId: state.selectedId ?? action.items[0].id,
      }
    }

    case 'upload/phase': {
      return updateItem(state, action.id, (item) => {
        if (action.phase === 'requesting') {
          if (item.upload.kind !== 'queued') return item
          return { ...item, upload: { kind: 'requesting' } }
        }
        if (action.phase === 'uploading') {
          if (item.upload.kind !== 'requesting' && item.upload.kind !== 'uploading') return item
          return {
            ...item,
            upload: { kind: 'uploading', sent: 0, total: action.total ?? 0 },
          }
        }
        if (item.upload.kind !== 'uploading' && item.upload.kind !== 'requesting') return item
        return { ...item, upload: { kind: 'processing' } }
      })
    }

    case 'upload/progress': {
      return updateItem(state, action.id, (item) => {
        if (item.upload.kind !== 'uploading') return item
        return {
          ...item,
          upload: {
            kind: 'uploading',
            sent: action.sent,
            total: action.total > 0 ? action.total : item.upload.total,
          },
        }
      })
    }

    case 'upload/ready': {
      return updateItem(state, action.id, (item) => {
        if (!isInFlight(item.upload)) return item
        return { ...item, upload: { kind: 'ready', media: action.media } }
      })
    }

    case 'upload/failed': {
      return updateItem(state, action.id, (item) => {
        if (item.upload.kind === 'ready' || item.upload.kind === 'failed') return item
        return {
          ...item,
          upload: { kind: 'failed', phase: action.phase, message: action.message },
        }
      })
    }

    case 'upload/retry': {
      return updateItem(state, action.id, (item) => {
        if (item.upload.kind !== 'failed') return item
        return { ...item, upload: { kind: 'queued' } }
      })
    }

    case 'item/select': {
      if (!state.items.some((item) => item.id === action.id)) return state
      return { ...state, selectedId: action.id }
    }

    case 'item/remove': {
      const index = state.items.findIndex((item) => item.id === action.id)
      if (index === -1) return state
      const items = state.items.filter((item) => item.id !== action.id)
      let selectedId = state.selectedId
      if (selectedId === action.id) {
        selectedId = (items[index] ?? items[index - 1])?.id ?? null
      }
      return { items, selectedId }
    }

    case 'draft/change': {
      return updateItem(state, action.id, (item) => {
        if (item.save.kind === 'saving' || item.save.kind === 'updating') return item
        const save =
          item.save.kind === 'failed'
            ? item.save.cardId != null
              ? { kind: 'saved' as const, cardId: item.save.cardId }
              : { kind: 'idle' as const }
            : item.save
        return {
          ...item,
          draft: { ...item.draft, ...action.changes },
          save,
        }
      })
    }

    case 'draft/bulk-change': {
      let changed = false
      const items = state.items.map((item) => {
        if (
          item.save.kind === 'saving' ||
          item.save.kind === 'updating' ||
          savedCardId(item.save) != null
        ) {
          return item
        }
        changed = true
        return {
          ...item,
          draft: { ...item.draft, ...action.changes },
          save: item.save.kind === 'failed' ? ({ kind: 'idle' } as const) : item.save,
        }
      })
      return changed ? { ...state, items } : state
    }

    case 'save/start': {
      return updateItem(state, action.id, (item) => {
        if (item.upload.kind !== 'ready') return item
        if (item.save.kind === 'saving' || item.save.kind === 'updating') return item

        const cardId = savedCardId(item.save)
        return { ...item, save: cardId != null ? { kind: 'updating', cardId } : { kind: 'saving' } }
      })
    }

    case 'save/succeeded': {
      return updateItem(state, action.id, (item) => {
        if (item.save.kind !== 'saving' && item.save.kind !== 'updating') return item
        return {
          ...item,
          save: { kind: 'saved', cardId: action.cardId },
          savedSnapshot: item.draft,
        }
      })
    }

    case 'save/failed': {
      return updateItem(state, action.id, (item) => {
        if (item.save.kind !== 'saving' && item.save.kind !== 'updating') return item
        if (item.save.kind !== 'updating') {
          return {
            ...item,
            save: { kind: 'failed', message: action.message, field: action.field },
          }
        }
        return {
          ...item,
          save: {
            kind: 'failed',
            message: action.message,
            field: action.field,
            cardId: item.save.cardId,
          },
        }
      })
    }

    default:
      return state
  }
}
