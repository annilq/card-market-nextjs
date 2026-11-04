// 卡牌目录：列表 + 筛选 + 分页。
//
// 移植自 TanStack Start 的 `/{-$locale}/cards/`。三条不能丢的东西：
//   1. **状态全在 URL**。筛选、排序、分页、关键词都能分享与回访（PRODUCT.md「URL 是状态」），
//      所以这里是服务端读 searchParams → 直接查库，而不是客户端拿回来再筛。
//   2. **级联筛选**。IP → 系列 → 子系列，父级取消时连带清掉子级（逻辑在 CatalogFilters 里）。
//   3. **分享链接可被爬虫走**。翻页用 `<Link>`（不是按钮回调），见 Pagination。
//
// 结果网格与分页是服务端渲染的，作为 children 传进 CatalogFilters：
// 筛选与排序要读写 URL，必须在客户端；而结果本身不该为了这一点下沉到客户端。
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { CardCard } from '@/components/CardCard'
import { Pagination } from '@/components/Pagination'
import { CatalogFilters } from '@/components/catalog/CatalogFilters'
import { getCards, getFacets, getSiteSettings } from '@/lib/data'
import { parseCardSearch, numOf, rawOf, csvOrNull, type CardSearchParams } from '@/lib/card-search'
import { getTranslator } from '@/lib/i18n/t'
import { LOCALES, localizeHref, type Locale } from '@/lib/i18n/locales'
import { DEFAULT_CARD_SORT, type CardQuery } from '@/lib/types'
import { getOrigin } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 24

/**
 * 结果网格的锚点 id。
 * 翻页链接带上 `#card-grid`：源码里翻页后是把视口带回网格顶端（而不是页顶、
 * 更不是停在页脚），但 Pagination 被要求是服务端组件、不能用 `scrollIntoView`，
 * 因此改用锚点交给浏览器完成同一件事。
 */
const CARD_GRID_ID = 'card-grid'

type SearchParams = CardSearchParams

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<SearchParams>
}

/* ===== searchParams → CardQuery ===== */
// 解析走 `src/lib/card-search.ts`：首页与这里共用同一份参数表，
// 各写一遍的话改一处忘一处，分享出去的链接就会换意思。
// 分页是 /cards 独有的（首页只露第一屏），因此只有这里带 `withPage`。
function parseCardQuery(sp: SearchParams): CardQuery {
  return parseCardSearch(sp, { limit: PAGE_SIZE, withPage: true })
}

/** 翻页链接：把当前全部筛选条件带过去，只换 `page`。 */
function buildCardsHref(locale: Locale, query: CardQuery, page: number): string {
  const sp = new URLSearchParams()
  // 多选值一律写逗号（`ip=1,2`）：比重复参数少一半字符，手写与分享都更短。
  const put = (key: string, value: string | null) => {
    if (value != null) sp.set(key, value)
  }
  put('ip', csvOrNull(query.ipIds))
  put('series', csvOrNull(query.seriesIds))
  put('sub', csvOrNull(query.subSeriesIds))
  put('rarity', csvOrNull(query.rarityIds))
  put('status', csvOrNull(query.cardStatus))
  if (query.highValueOnly) sp.set('hv', '1')
  if (query.minPrice != null) sp.set('min', String(query.minPrice))
  if (query.maxPrice != null) sp.set('max', String(query.maxPrice))
  if (query.q) sp.set('q', query.q)
  // 默认值不写进 URL：`/cards` 与 `/cards?sort=price_desc&page=1` 是同一个页面，
  // 留着只会让分享链接变长、也让爬虫多认一份重复地址。
  if (query.sort && query.sort !== DEFAULT_CARD_SORT) sp.set('sort', query.sort)
  if (page > 1) sp.set('page', String(page))

  const base = localizeHref('/cards', locale)
  const qs = sp.toString()
  return `${base}${qs ? `?${qs}` : ''}#${CARD_GRID_ID}`
}

export default async function CardsPage({ params, searchParams }: Props) {
  const { locale: raw } = await params
  if (!(raw in LOCALES)) notFound()
  const locale = raw as Locale

  const query = parseCardQuery(await searchParams)
  const result = await getCards(query)
  const facets = await getFacets()

  // 结果网格与分页都在 CatalogFilters 里（它是客户端组件，需要 children 由服务端渲染传入），
  // 因此这一层没有可见文案，也就不需要翻译函数。
  const totalPages = Math.max(1, result.totalPages || 1)
  const page = Math.min(Math.max(1, result.page || query.page || 1), totalPages)
  const isEmpty = result.items.length === 0

  const grid = isEmpty ? null : (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {result.items.map((card, i) => (
        // 首行 5 张设 priority（列表页第一屏能看到的卡片），优化 LCP。
        <CardCard key={card.id} card={card} locale={locale} priority={i < 5} />
      ))}
    </div>
  )

  return (
    <CatalogFilters facets={facets} total={result.total} empty={isEmpty}>
      {grid}
      <Pagination
        page={page}
        totalPages={totalPages}
        locale={locale}
        buildHref={(n) => buildCardsHref(locale, query, n)}
      />
    </CatalogFilters>
  )
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale: raw } = await params
  // 语言段非法时页面会 404；元数据这里不该先抛错，退回默认语言把标签发全。
  const locale = (raw in LOCALES ? raw : 'zh') as Locale

  const t = getTranslator(locale)
  const sp = await searchParams
  const q = rawOf(sp, 'q')
  const page = numOf(sp, 'page') ?? 1

  // 列表页标题跟随当前筛选：带关键词时用「卡牌 — X」。
  const title = q ? `${t('navCards')} — ${q}` : t('navCards')
  const siteName = (await getSiteSettings()).siteName || t('defaultSiteName')
  const path = localizeHref('/cards', locale)
  const origin = await getOrigin()

  return {
    title: `${title} | ${siteName}`,
    description: LOCALES[locale].description,
    // 搜索结果与分页都不收录：内容随 query 有无穷组合，收录反而稀释索引。
    robots: q || page > 1 ? { index: false, follow: true } : undefined,
    // canonical 指向不带 query 的干净地址：筛选后的地址与它是同一页内容。
    alternates: { canonical: `${origin}${path}` },
    openGraph: {
      type: 'website',
      title,
      description: LOCALES[locale].description,
      url: `${origin}${path}`,
    },
  }
}
