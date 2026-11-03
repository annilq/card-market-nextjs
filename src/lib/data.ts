import { getPayloadClient } from './payload'
import { renderRichText } from './richtext'
import {
  DEFAULT_CARD_SORT,
  type AnnouncementView,
  type BannerView,
  type CardListResult,
  type CardQuery,
  type CardSort,
  type CardView,
  type FacetView,
  type ImageView,
  type InfoPageView,
  type ShopView,
  type SiteSettingsView,
} from './types'
import type { Media } from '@/payload-types'

export type { SiteSettingsView }

const SORT_MAP: Record<CardSort, string> = {
  price_desc: '-price',
  price_asc: 'price',
  newest: '-createdAt',
  oldest: 'createdAt',
}

const relId = (value: unknown): number | null => {
  if (value == null) return null
  if (typeof value === 'object') return (value as { id?: number }).id ?? null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Payload 文档 id 在不同 API 下可能是 string 或 number，统一收成 number 以匹配视图模型。 */
const toId = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const relName = (value: unknown): string | null => {
  if (value && typeof value === 'object' && 'name' in (value as Record<string, unknown>)) {
    return String((value as { name: string }).name)
  }
  return null
}

function toImageView(value: unknown): ImageView | null {
  if (!value || typeof value !== 'object') return null
  const media = value as Media
  return {
    url: media.url ?? '',
    alt: media.alt ?? '',
    width: media.width ?? null,
    height: media.height ?? null,
    thumbUrl: media.sizes?.thumb?.url ?? null,
    cardUrl: media.sizes?.card?.url ?? null,
    bannerUrl: media.sizes?.banner?.url ?? null,
  }
}

const toImages = (value: unknown): ImageView[] => {
  if (!Array.isArray(value)) return []
  return value.map(toImageView).filter((image): image is ImageView => Boolean(image))
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Where = Record<string, any>

function toCardView(doc: any): CardView {
  return {
    id: toId(doc.id),
    name: doc.name,
    code: doc.code ?? null,
    price: doc.price ?? null,
    ipId: relId(doc.ip),
    ipName: relName(doc.ip),
    seriesId: relId(doc.series),
    seriesName: relName(doc.series),
    subSeriesId: relId(doc.subSeries),
    subSeriesName: relName(doc.subSeries),
    rarityId: relId(doc.rarity),
    rarityName: relName(doc.rarity),
    images: toImages(doc.images),
    isHighValue: Boolean(doc.isHighValue),
    cardStatus: doc.cardStatus ?? 'raw',
    descriptionHtml: renderRichText(doc.description),
    createdAt: doc.createdAt,
  }
}

/** 站点设置（Payload Global，单例）。 */
export async function getSiteSettings(): Promise<SiteSettingsView> {
  const payload = await getPayloadClient()
  const settings = await payload.findGlobal({
    slug: 'site-settings',
    depth: 2,
    overrideAccess: false,
  })
  return {
    siteName: settings.siteName || '卡牌回购站',
    logo: toImageView(settings.logo),
    xAccount: settings.xAccount ?? null,
    contactEmail: settings.contactEmail ?? null,
    contactPhone: settings.contactPhone ?? null,
    businessHours: settings.businessHours ?? null,
    shopAddress: settings.shopAddress ?? null,
  }
}

/** 首页轮播（单槽位，按 sort 升序）。 */
export async function getBanners(): Promise<BannerView[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'banners',
    depth: 1,
    overrideAccess: false,
    sort: 'sort',
    limit: 20,
  })
  return result.docs.map((doc) => ({
    id: toId(doc.id),
    title: doc.title ?? null,
    description: doc.description ?? null,
    image: toImageView(doc.image),
    link: doc.link ?? null,
  }))
}

/** 公告列表：置顶优先，其次发布时间倒序（未设发布时间的按创建时间兜底）。 */
export async function getAnnouncements(options: { limit?: number; page?: number } = {}) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'announcements',
    depth: 1,
    overrideAccess: false,
    limit: options.limit ?? 20,
    page: options.page ?? 1,
    sort: '-publishedAt',
  })
  const docs = [...result.docs].sort((a, b) => {
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1
    const left = a.publishedAt ?? a.createdAt
    const right = b.publishedAt ?? b.createdAt
    return left < right ? 1 : left > right ? -1 : 0
  })
  return {
    items: docs.map(
      (doc): AnnouncementView => ({
        id: toId(doc.id),
        title: doc.title,
        bodyHtml: renderRichText(doc.body),
        publishedAt: doc.publishedAt ?? null,
        isPinned: Boolean(doc.isPinned),
      }),
    ),
    total: result.totalDocs,
    totalPages: result.totalPages,
  }
}

export async function getAnnouncement(id: number): Promise<AnnouncementView | null> {
  const payload = await getPayloadClient()
  try {
    const doc = await payload.findByID({
      collection: 'announcements',
      id,
      depth: 1,
      overrideAccess: false,
    })
    return {
      id: toId(doc.id),
      title: doc.title,
      bodyHtml: renderRichText(doc.body),
      publishedAt: doc.publishedAt ?? null,
      isPinned: Boolean(doc.isPinned),
    }
  } catch {
    return null
  }
}

/** 卡牌列表：级联筛选 + 价格区间 + 关键词（卡名 / 编号）+ 排序 + 分页。 */
export async function getCards(query: CardQuery = {}): Promise<CardListResult> {
  const payload = await getPayloadClient()
  const and: Where[] = []
  if (query.ipIds?.length) and.push({ ip: { in: query.ipIds } })
  if (query.seriesIds?.length) and.push({ series: { in: query.seriesIds } })
  if (query.subSeriesIds?.length) and.push({ subSeries: { in: query.subSeriesIds } })
  if (query.rarityIds?.length) and.push({ rarity: { in: query.rarityIds } })
  if (query.cardStatus?.length) and.push({ cardStatus: { in: query.cardStatus } })
  if (query.highValueOnly) and.push({ isHighValue: { equals: true } })
  if (query.minPrice != null || query.maxPrice != null) {
    const price: Where = {}
    if (query.minPrice != null) price.greater_than_equal = query.minPrice
    if (query.maxPrice != null) price.less_than_equal = query.maxPrice
    and.push({ price })
  }
  const q = query.q?.trim()
  if (q) and.push({ or: [{ name: { like: q } }, { code: { like: q } }] })

  const result = await payload.find({
    collection: 'cards',
    depth: 2,
    overrideAccess: false,
    where: and.length ? { and } : {},
    sort: SORT_MAP[query.sort ?? DEFAULT_CARD_SORT],
    limit: query.limit ?? 24,
    page: query.page ?? 1,
  })

  return {
    items: result.docs.map(toCardView),
    total: result.totalDocs,
    page: result.page ?? 1,
    totalPages: result.totalPages,
  }
}

export async function getCard(id: number): Promise<CardView | null> {
  const payload = await getPayloadClient()
  try {
    const doc = await payload.findByID({ collection: 'cards', id, depth: 2, overrideAccess: false })
    return toCardView(doc)
  } catch {
    return null
  }
}

/** 首页「最新上架」。 */
export async function getLatestCards(limit = 8): Promise<CardView[]> {
  const result = await getCards({ limit, sort: 'newest' })
  return result.items
}

/** 首页「高价买取」。 */
export async function getHighValueCards(limit = 8): Promise<CardView[]> {
  const result = await getCards({ limit, sort: 'price_desc', highValueOnly: true })
  return result.items
}

/** 筛选用维度：IP → 系列 → 子系列，外加稀有度。 */
export async function getFacets(): Promise<{
  ips: FacetView[]
  series: FacetView[]
  subSeries: FacetView[]
  rarities: FacetView[]
}> {
  const payload = await getPayloadClient()
  const [ips, series, subSeries, rarities] = await Promise.all([
    payload.find({ collection: 'ips', depth: 0, overrideAccess: false, limit: 200, sort: 'sort' }),
    payload.find({ collection: 'series', depth: 0, overrideAccess: false, limit: 500, sort: 'sort' }),
    payload.find({ collection: 'sub-series', depth: 0, overrideAccess: false, limit: 1000, sort: 'sort' }),
    payload.find({ collection: 'rarities', depth: 0, overrideAccess: false, limit: 200, sort: 'sort' }),
  ])
  return {
    ips: ips.docs.map((doc) => ({ id: toId(doc.id), name: doc.name, sort: doc.sort ?? 0 })),
    series: series.docs.map((doc) => ({
      id: toId(doc.id),
      name: doc.name,
      sort: doc.sort ?? 0,
      parentId: relId(doc.ip),
    })),
    subSeries: subSeries.docs.map((doc) => ({
      id: toId(doc.id),
      name: doc.name,
      sort: doc.sort ?? 0,
      parentId: relId(doc.series),
    })),
    rarities: rarities.docs.map((doc) => ({ id: toId(doc.id), name: doc.name, sort: doc.sort ?? 0 })),
  }
}

export async function getShops(): Promise<ShopView[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'shops',
    depth: 1,
    overrideAccess: false,
    limit: 100,
    sort: 'sort',
  })
  return result.docs.map((doc) => ({
    id: toId(doc.id),
    name: doc.name,
    address: doc.address ?? null,
    lat: doc.lat ?? null,
    lng: doc.lng ?? null,
    phone: doc.phone ?? null,
    businessHours: doc.businessHours ?? null,
    description: doc.description ?? null,
    image: toImageView(doc.image),
  }))
}

export async function getInfoPage(key: string): Promise<InfoPageView | null> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'info-pages',
    depth: 1,
    overrideAccess: false,
    limit: 1,
    where: { pageKey: { equals: key } },
  })
  const doc = result.docs[0]
  if (!doc) return null
  return { id: toId(doc.id), pageKey: doc.pageKey, title: doc.title, bodyHtml: renderRichText(doc.body) }
}

/** 首页「按 IP 浏览」只需要 IP 一层，不值得拉全套维度。 */
export async function getIps(): Promise<FacetView[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'ips',
    depth: 0,
    overrideAccess: false,
    limit: 200,
    sort: 'sort',
  })
  return result.docs.map((doc) => ({ id: toId(doc.id), name: doc.name, sort: doc.sort ?? 0 }))
}
