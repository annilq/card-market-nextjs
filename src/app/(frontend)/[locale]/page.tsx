// 首页（移植自 TanStack Start 的 `{-$locale}.index.tsx`）。
//
// 顺序就是源站的顺序：**banner 轮播 → 通知公告 → 高价买取横条 → 卡牌筛选 + 结果网格**。
// 之前这一版是「hero 搜索 → banner → 公告 → 高价 → IP tab → 最新上架」，与源站差在三处：
//  1. 源站的搜索框住在**顶栏**（桌面一行、<lg 第二行），首页没有独立的 hero；
//  2. 「按 IP 浏览」那一排不是独立 section——它是筛选区的第一行（ CatalogFilters 里）；
//  3. 首页最后一块不是「最新上架」的静态最新 12 张，而是**筛选 drive 的结果**：
//     条件写在 URL 里（`?ip=1&series=2&sort=price_asc`），由服务端直接查，
//     因此可以被分享、可以后退、刷新不丢，刷新后首屏就是筛完的结果。
//
// 数据在服务端一次性取齐（Promise.all），页面本身是 async server component。
// 首页也分页（每页 48 张，8 列 × 6 行）：分页链接保留筛选条件，条件变化由
// CatalogFilters.push 统一删掉 `page` 回到第 1 页；第 2 页起 noindex 避免重复内容。

import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CatalogFilters } from '@/components/catalog/CatalogFilters'
import { ContentLanguageNotice } from '@/components/ContentLanguageNotice'
import { BannerCarousel } from '@/components/home/BannerCarousel'
import { HighValueStrip } from '@/components/home/HighValueStrip'
import { HomeCardGrid } from '@/components/home/HomeCardGrid'
import { HOME_NOTICE_COUNT, HOME_PINNED_COUNT, HomeNotices } from '@/components/home/HomeNotices'
import { Pagination } from '@/components/Pagination'
import {
  getAnnouncements,
  getBanners,
  getCards,
  getFacets,
  getHighValueCards,
  getSiteSettings,
} from '@/lib/data'
import { parseCardSearch, numOf, rawOf, csvOrNull, type CardSearchParams } from '@/lib/card-search'
import { DEFAULT_CARD_SORT, type CardQuery } from '@/lib/types'
import { DEFAULT_LOCALE, LOCALES, localizeHref, type Locale } from '@/lib/i18n/locales'
import { absUrl, getOrigin } from '@/lib/site-url'
import { getTranslator } from '@/lib/i18n/t'

/** 首页卡牌网格每页数量：8 列 × 6 行。 */
const HOME_PAGE_SIZE = 48

/** 结果网格的锚点：翻页后回到网格顶端（与 /cards 一致）。 */
const CARD_GRID_ID = 'card-grid'

/**
 * 翻页链接：保留当前全部筛选条件，只换 `page`，并带回网格锚点。
 * 与 `/cards` 的 buildCardsHref 同一套参数表，只是 base 改成首页路径。
 */
function buildHomeHref(locale: Locale, query: CardQuery, page: number): string {
  const sp = new URLSearchParams()
  const put = (key: string, value: string | null) => {
    if (value != null) sp.set(key, value)
  }
  put('ip', csvOrNull(query.ipIds))
  put('series', csvOrNull(query.seriesIds))
  put('sub', csvOrNull(query.subSeriesIds))
  put('status', csvOrNull(query.cardStatusIds))
  if (query.highValueOnly) sp.set('hv', '1')
  if (query.noDeductionOnly) sp.set('nd', '1')
  if (query.minPrice != null) sp.set('min', String(query.minPrice))
  if (query.maxPrice != null) sp.set('max', String(query.maxPrice))
  if (query.q) sp.set('q', query.q)
  if (query.sort && query.sort !== DEFAULT_CARD_SORT) sp.set('sort', query.sort)
  if (page > 1) sp.set('page', String(page))

  const base = localizeHref('/', locale)
  const qs = sp.toString()
  return `${base}${qs ? `?${qs}` : ''}#${CARD_GRID_ID}`
}

type Props = {
  params: Promise<{ locale: string }>
  searchParams?: Promise<CardSearchParams>
}

export const dynamic = 'force-dynamic'

// generateMetadata 与页面本体都要读 banner（封面图），按请求合并成一次查询。
const loadBanners = cache(() => getBanners())

/**
 * 首页 meta：用 LOCALES 里那条完整的站点标题与描述（不是「站名 + 页名」的组合），
 * 因为首页就是站点入口本身。canonical 始终落在 `/`：筛选与翻页只改查询串，
 * 把每种组合算成独立页面对索引只有害处；第 2 页起再显式 noindex。
 */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale: raw } = await params
  if (!(raw in LOCALES)) notFound()
  const locale = raw as Locale
  const sp = await searchParams
  const page = Math.max(1, numOf(sp ?? {}, 'page') ?? 1)
  const q = rawOf(sp ?? {}, 'q')
  const origin = await getOrigin()
  const url = await absUrl('/', locale)
  const settings = await getSiteSettings()
  const { title } = LOCALES[locale]
  const siteName = settings.siteName?.trim() || getTranslator(locale)('defaultSiteName')
  const description = settings.intro?.trim() || LOCALES[locale].description
  const [first] = await loadBanners()
  const cover = first?.image?.bannerUrl || first?.image?.url

  return {
    title,
    description,
    // 翻页与搜索结果都不收录：内容与第 1 页高度重复，only index 干净首页。
    robots: page > 1 || q ? { index: false, follow: true } : undefined,
    alternates: { canonical: url },
    openGraph: {
      siteName,
      title,
      description,
      url,
      // 分享图优先取第一条 banner；没有 banner 时不给 image（比给一张空图好）。
      images: cover ? [new URL(cover, origin).toString()] : undefined,
    },
  }
}

/* ===== searchParams → CardQuery ===== */
// 解析走 `src/lib/card-search.ts`：与 `/cards` 同一份参数表、同一份实现
// （两页是同一个筛选栏的两处落点，参数换了名字就等于换了一门语言）。
// 首页与 `/cards` 共用一份参数表与解析（见 `card-search.ts`）；分页也是同一套
// `page` 参数，只是每页仍是 48 张（8 列 × 6 行）。
function parseHomeQuery(sp: CardSearchParams) {
  return parseCardSearch(sp, { limit: HOME_PAGE_SIZE, withPage: true })
}

export default async function Page({ params, searchParams }: Props) {
  const { locale: raw } = await params
  if (!(raw in LOCALES)) notFound()
  const locale = raw as Locale
  const query = parseHomeQuery((await searchParams) ?? {})

  const [banners, notices, highValue, facets, catalog] = await Promise.all([
    loadBanners(),
    // 首页最多 3 条：置顶优先（最多 3 条），不足 3 条时按发布时间倒序补满。
    getAnnouncements({ limit: HOME_NOTICE_COUNT, maxPinned: HOME_PINNED_COUNT }),
    getHighValueCards(10),
    // 筛选维度的完整四层（IP → 系列 → 子系列 + 稀有度）：首页用的筛选栏与 /cards 是同一个。
    getFacets(),
    getCards(query),
  ])

  // 越界的 page（筛选后原页码不存在）夹到有效范围：UI 与 /cards 一致显示末页，
  // 与 buildHomeHref 一起保证分页链接始终落在真实存在的页上。
  const totalPages = Math.max(1, catalog.totalPages || 1)
  const page = Math.min(Math.max(1, catalog.page || query.page || 1), totalPages)

  // 首屏主图（LCP）直接预取：banner 经私有 S3 302 过来，预加载让浏览器在解析
  // 到 <img> 之前就发起请求，与建连（preconnect）配合能再压一点 LCP。
  const lcpBanner = banners[0]?.image?.bannerUrl || banners[0]?.image?.url || null

  return (
    <div className="space-y-6">
      {/* 首屏主图预加载（见上方 lcpBanner 计算）。 */}
      {lcpBanner && <link rel="preload" as="image" href={lcpBanner} fetchPriority="high" />}
      {/* 非默认语言：后台内容（卡名 / 公告 / 门店）只有中文一份，切换语言只换界面文字，
          先说清楚再给内容，免得用户以为是翻译漏了。 */}
      {locale !== DEFAULT_LOCALE && <ContentLanguageNotice locale={locale} />}

      {/* banner 与通知条紧邻：实测 banner 底边 649、通知红条顶边 650，两者读作同一块。 */}
      {banners.length > 0 && <BannerCarousel banners={banners} />}

      {notices.items.length > 0 && (
        <HomeNotices items={notices.items} locale={locale} />
      )}

      {highValue.length > 0 && <HighValueStrip items={highValue} locale={locale} />}

      {/* 卡牌筛选 + 结果。原来的「按 IP 浏览」胶囊与「最新上架」块合到这里：
          前者是筛选区的第一行（tab），后者被 URL 驱动的列表取代——
          列表页能筛的条件首页也都能筛，没必要给一个只能看不能筛的版本。 */}
      <section>
        <CatalogFilters
          layout="home"
          facets={facets}
          total={catalog.total}
          empty={catalog.items.length === 0}
        >
          {/* 锚点 id 放在网格外层：翻页后回到结果顶端（与 /cards 一致）。 */}
          <div id={CARD_GRID_ID} className="scroll-mt-20 outline-none">
            <HomeCardGrid cards={catalog.items} locale={locale} />
          </div>
          {catalog.items.length > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              locale={locale}
              buildHref={(n) => buildHomeHref(locale, query, n)}
            />
          )}
        </CatalogFilters>
      </section>
    </div>
  )
}
