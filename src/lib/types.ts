// 面向页面的视图模型：把 Payload 的文档（含关系 ID / 富文本 JSON）收敛成页面能直接渲染的形状。
// 这样页面组件不需要知道 Payload 的关系展开规则，也不需要自己转富文本。

export type CardStatus = 'raw' | 'packaged'
export type CardSort = 'price_desc' | 'price_asc' | 'newest' | 'oldest'

export const CARD_SORTS: CardSort[] = ['price_desc', 'price_asc', 'newest', 'oldest']
export const DEFAULT_CARD_SORT: CardSort = 'price_desc'

export interface ImageView {
  url: string
  alt: string
  width?: number | null
  height?: number | null
  /** Payload 自动生成的缩略尺寸（imageSizes），前台按场景挑一个，避免整图直出。 */
  thumbUrl?: string | null
  cardUrl?: string | null
  bannerUrl?: string | null
}

export interface CardView {
  id: number
  name: string
  code: string | null
  price: number | null
  ipId: number | null
  ipName: string | null
  seriesId: number | null
  seriesName: string | null
  subSeriesId: number | null
  subSeriesName: string | null
  rarityId: number | null
  rarityName: string | null
  images: ImageView[]
  isHighValue: boolean
  cardStatus: CardStatus
  descriptionHtml: string
  createdAt: string
}

export interface BannerView {
  id: number
  title: string | null
  description: string | null
  image: ImageView | null
  link: string | null
}

export interface AnnouncementView {
  id: number
  title: string
  bodyHtml: string
  publishedAt: string | null
  isPinned: boolean
}

export interface ShopView {
  id: number
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  phone: string | null
  businessHours: string | null
  description: string | null
  image: ImageView | null
}

export interface InfoPageView {
  id: number
  pageKey: string
  title: string
  bodyHtml: string
}

export interface SiteSettingsView {
  siteName: string
  logo: ImageView | null
  xAccount: string | null
  contactEmail: string | null
  contactPhone: string | null
  businessHours: string | null
  shopAddress: string | null
}

export interface FacetView {
  id: number
  name: string
  sort: number
  parentId?: number | null
}

export interface CardQuery {
  ipIds?: number[]
  seriesIds?: number[]
  subSeriesIds?: number[]
  rarityIds?: number[]
  cardStatus?: CardStatus[]
  highValueOnly?: boolean
  minPrice?: number
  maxPrice?: number
  q?: string
  sort?: CardSort
  page?: number
  limit?: number
}

export interface CardListResult {
  items: CardView[]
  total: number
  page: number
  totalPages: number
}

/** 审核信息页的四个固定标识（前端路由 `/info/<key>` 与页脚入口共用）。 */
export type InfoPageKey = 'operation' | 'personal-info' | 'terms' | 'data-usage'
