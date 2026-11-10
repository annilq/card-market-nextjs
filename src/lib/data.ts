import { unstable_cache } from 'next/cache'
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

const relFlag = (value: unknown, key: string): boolean => Boolean(value && typeof value === 'object' && (value as Record<string, unknown>)[key])

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

// 列表卡片（CardCard 组件）从不渲染描述，因此列表视图不调用 renderRichText，
// 省去对每张卡做富文本序列化的无谓 CPU 开销；只有详情页才需要描述 HTML。
function toCardView(doc: any, withDescription = false): CardView {
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
    isNoDeduction: Boolean(doc.isNoDeduction),
    cardStatusId: relId(doc.cardStatus),
    cardStatusName: relName(doc.cardStatus),
    cardStatusAccent: relFlag(doc.cardStatus, 'accent'),
    descriptionHtml: withDescription ? renderRichText(doc.description) : '',
    createdAt: doc.createdAt,
  }
}

/** 站点设置（Payload Global，单例）。depth 1 已足够（logo 是单层媒体关系），
 * 并用 unstable_cache 缓存 10 分钟——它出现在每个页面的布局里，本是最大的重复查询源。 */
export const getSiteSettings = unstable_cache(
  async (): Promise<SiteSettingsView> => {
    const payload = await getPayloadClient()
    const settings = await payload.findGlobal({
      slug: 'site-settings',
      depth: 1,
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
  },
  ['site-settings'],
  // 站点设置出现在每个页面布局里，改动极少；后台改完由 afterChange 钩子主动失效，
  // 因此可以把缓存放到最长（1 天），大幅减少重复读取。
  { revalidate: 86400, tags: ['site-settings'] },
)

/** 首页轮播（单槽位，按 sort 升序）。缓存 5 分钟。 */
export const getBanners = unstable_cache(
  async (): Promise<BannerView[]> => {
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
  },
  ['banners'],
  // 轮播图改动极少，后台改完由 afterChange 钩子主动失效；缓存放到最长（1 天）。
  { revalidate: 86400, tags: ['banners'] },
)

type AnnouncementListOptions = {
  limit?: number
  page?: number
  /** 置顶最多展示几条：置顶再多也只取排序最靠前的这几条（首页用）。 */
  maxPinned?: number
}

type AnnouncementSortInput = {
  isPinned?: boolean | null
  sort?: number | null
  publishedAt?: string | null
  createdAt?: string | null
}

/** 公告的「有效时间」：设了发布时间按发布时间，否则按创建时间（留空 = 立即展示）。 */
function announcementTime(doc: AnnouncementSortInput): number {
  const value = doc.publishedAt ?? doc.createdAt
  const time = value ? Date.parse(value) : 0
  return Number.isNaN(time) ? 0 : time
}

/**
 * 公告排序：置顶组在前，组内按 sort 升序、再按时间倒序；
 * 未置顶组的 sort 不参与排序——它们只按时间倒序。
 */
function compareAnnouncements(a: AnnouncementSortInput, b: AnnouncementSortInput): number {
  const pinnedDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned))
  if (pinnedDiff !== 0) return pinnedDiff
  if (a.isPinned) {
    const orderDiff = (a.sort ?? 0) - (b.sort ?? 0)
    if (orderDiff !== 0) return orderDiff
  }
  return announcementTime(b) - announcementTime(a)
}

/**
 * 公告列表：置顶优先（置顶内按 sort 升序，其次时间倒序），未置顶按时间倒序。
 *
 * 排序不交给数据库：置顶/未置顶需要两套排序键，且「未设发布时间」要回退到创建时间
 * （Postgres 的 DESC 会把 NULL 排在最前）。公告量小（人工运营），因此一次取回全部
 * 可见条目在内存中排好再分页。这里不能用 Select API 只挑字段——createdAt 是内部字段，
 * 不在 select 结果里，而它正是「未设发布时间」时的排序兜底。
 * 这也修掉了「置顶了 B，首页却看不到」的根因：旧实现先按时间取前 N 条再排置顶，
 * 不在时间窗口里的置顶公告永远进不来。
 *
 * maxPinned 只用于首页：先取排序最靠前的若干条置顶，再用最新公告补满 limit。
 * 缓存 10 分钟，后台改完由 afterChange 钩子主动失效。
 */
export const getAnnouncements = unstable_cache(
  async (options: AnnouncementListOptions = {}) => {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'announcements',
      depth: 0,
      overrideAccess: false,
      pagination: false,
    })

    const docs = [...result.docs].sort(compareAnnouncements)
    const limit = options.limit ?? 20
    const page = options.page ?? 1
    const total = docs.length
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0

    let items = docs
    if (options.maxPinned != null) {
      const pinned = docs.filter((doc) => doc.isPinned).slice(0, Math.min(options.maxPinned, limit))
      const unpinned = docs
        .filter((doc) => !doc.isPinned)
        .slice(0, Math.max(0, limit - pinned.length))
      items = [...pinned, ...unpinned]
    } else {
      const start = (page - 1) * limit
      items = docs.slice(start, start + limit)
    }

    return {
      items: items.map(
        (doc): AnnouncementView => ({
          id: toId(doc.id),
          title: doc.title,
          // 列表视图从不渲染正文；详情页由 getAnnouncement 单独取回完整文档。
          bodyHtml: '',
          publishedAt: doc.publishedAt ?? null,
          isPinned: Boolean(doc.isPinned),
        }),
      ),
      total,
      totalPages,
    }
  },
  // unstable_cache 默认已把函数参数（options）纳入缓存键，不同 limit/page 组合各自独立缓存。
  undefined,
  { revalidate: 600, tags: ['announcements'] },
)

export const getAnnouncement = unstable_cache(
  async (id: number): Promise<AnnouncementView | null> => {
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
  },
  // unstable_cache 默认已把函数参数（id）纳入缓存键。后台改完由 afterChange 钩子主动失效。
  undefined,
  { revalidate: 86400, tags: ['announcements'] },
)

/** 卡牌列表：级联筛选 + 价格区间 + 关键词（卡名 / 编号）+ 排序 + 分页。
 * depth 1 已足够（列表只需要 IP/系列/子系列/稀有度的 name，嵌套一层即可），
 * 并用 unstable_cache 缓存 60 秒——不同筛选/分页/关键词组合各自独立缓存，
 * 重复浏览（包括客户端页面跳转）命中缓存后不再打数据库。 */
export const getCards = unstable_cache(
  async (query: CardQuery = {}): Promise<CardListResult> => {
    const payload = await getPayloadClient()
    const and: Where[] = []
    if (query.ipIds?.length) and.push({ ip: { in: query.ipIds } })
    if (query.seriesIds?.length) and.push({ series: { in: query.seriesIds } })
    if (query.subSeriesIds?.length) and.push({ subSeries: { in: query.subSeriesIds } })
    if (query.rarityIds?.length) and.push({ rarity: { in: query.rarityIds } })
    if (query.cardStatusIds?.length) and.push({ cardStatus: { in: query.cardStatusIds } })
    if (query.highValueOnly) and.push({ or: [{ isHighValue: { equals: true } }, { isNoDeduction: { equals: true } }] })
    if (query.minPrice != null || query.maxPrice != null) {
      const price: Where = {}
      if (query.minPrice != null) price.greater_than_equal = query.minPrice
      if (query.maxPrice != null) price.less_than_equal = query.maxPrice
      and.push({ price })
    }
    const q = query.q?.trim()
    // 与后台列表搜索同一组字段：卡名 / 编号 / 稀有度名称。
    // 'rarity.name' 是关系字段的嵌套路径，Payload 会 JOIN rarities 表后按名字做 like。
    if (q) and.push({ or: [{ name: { like: q } }, { code: { like: q } }, { 'rarity.name': { like: q } }] })

    const result = await payload.find({
      collection: 'cards',
      depth: 1,
      overrideAccess: false,
      where: and.length ? { and } : {},
      sort: SORT_MAP[query.sort ?? DEFAULT_CARD_SORT],
      limit: query.limit ?? 24,
      page: query.page ?? 1,
    })

    return {
      items: result.docs.map((doc) => toCardView(doc, false)),
      total: result.totalDocs,
      page: result.page ?? 1,
      totalPages: result.totalPages,
    }
  },
  // unstable_cache 默认已把函数参数（query）纳入缓存键，不同筛选/分页/关键词组合各自独立缓存。
  // 列表筛选组合多、写频率低，后台改完由 afterChange 钩子主动失效；缓存放 1 小时。
  undefined,
  { revalidate: 3600, tags: ['cards'] },
)

export const getCard = unstable_cache(
  async (id: number): Promise<CardView | null> => {
    const payload = await getPayloadClient()
    try {
      const doc = await payload.findByID({ collection: 'cards', id, depth: 1, overrideAccess: false })
      return toCardView(doc, true)
    } catch {
      return null
    }
  },
  // unstable_cache 默认已把函数参数（id）纳入缓存键。后台改完由 afterChange 钩子主动失效。
  undefined,
  { revalidate: 86400, tags: ['cards'] },
)

/** 首页「最新上架」。 */
export async function getLatestCards(limit = 8): Promise<CardView[]> {
  const result = await getCards({ limit, sort: 'newest' })
  return result.items
}

/** 首页「高价买取」栏目。
 *  横条现同时纳入高价买取与不减额买取两类卡牌。按后台排序号升序（未设序号的按 Postgres
 *  ASC 默认 NULLS LAST 垫后），同序号再按发布时间倒序；最多 10 张，交给前端轮播。 */
export const getHighValueCards = unstable_cache(
  async (limit = 10): Promise<CardView[]> => {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'cards',
      depth: 1,
      overrideAccess: false,
      where: { or: [{ isHighValue: { equals: true } }, { isNoDeduction: { equals: true } }] },
      sort: ['sort', '-createdAt'],
      limit,
    })
    return result.docs.map((doc) => toCardView(doc, false))
  },
  ['high-value-cards'],
  // 与 getCards 共用 cards 标签，后台改完由 afterChange 钩子主动失效。
  { revalidate: 3600, tags: ['cards'] },
)

/** 筛选用维度：IP → 系列 → 子系列，外加稀有度与卡牌状态。缓存 5 分钟——它出现在
 * 首页与列表页，是最常被重复查询的静态维度。 */
export const getFacets = unstable_cache(
  async (): Promise<{
    ips: FacetView[]
    series: FacetView[]
    subSeries: FacetView[]
    rarities: FacetView[]
    cardStatuses: FacetView[]
  }> => {
    const payload = await getPayloadClient()
    const [ips, series, subSeries, rarities, cardStatuses] = await Promise.all([
      payload.find({ collection: 'ips', depth: 0, overrideAccess: false, limit: 200, sort: 'sort' }),
      payload.find({ collection: 'series', depth: 0, overrideAccess: false, limit: 500, sort: 'sort' }),
      payload.find({ collection: 'sub-series', depth: 0, overrideAccess: false, limit: 1000, sort: 'sort' }),
      payload.find({ collection: 'rarities', depth: 0, overrideAccess: false, limit: 200, sort: 'sort' }),
      payload.find({ collection: 'card-statuses', depth: 0, overrideAccess: false, limit: 200, sort: 'sort' }),
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
      cardStatuses: cardStatuses.docs.map((doc) => ({ id: toId(doc.id), name: doc.name, sort: doc.sort ?? 0 })),
    }
  },
  ['facets'],
  // 维度（IP/系列/子系列/稀有度/卡牌状态）改动极少，后台改完由 afterChange 钩子主动失效；缓存放最长（1 天）。
  { revalidate: 86400, tags: ['facets'] },
)

export const getShops = unstable_cache(
  async (): Promise<ShopView[]> => {
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
  },
  ['shops'],
  // 门店列表改动极少，后台改完由 afterChange 钩子主动失效；缓存放最长（1 天）。
  { revalidate: 86400, tags: ['shops'] },
)

export const getInfoPage = unstable_cache(
  async (key: string): Promise<InfoPageView | null> => {
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
  },
  // unstable_cache 默认已把函数参数（key）纳入缓存键。后台改完由 afterChange 钩子主动失效。
  undefined,
  { revalidate: 86400, tags: ['info-pages'] },
)

/** 首页「按 IP 浏览」只需要 IP 一层，不值得拉全套维度。 */
export const getIps = unstable_cache(
  async (): Promise<FacetView[]> => {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'ips',
      depth: 0,
      overrideAccess: false,
      limit: 200,
      sort: 'sort',
    })
    return result.docs.map((doc) => ({ id: toId(doc.id), name: doc.name, sort: doc.sort ?? 0 }))
  },
  ['ips'],
  { revalidate: 300, tags: ['facets'] },
)
