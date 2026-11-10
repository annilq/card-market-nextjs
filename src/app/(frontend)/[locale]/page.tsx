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

import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CatalogFilters } from '@/components/catalog/CatalogFilters'
import { ContentLanguageNotice } from '@/components/ContentLanguageNotice'
import { BannerCarousel } from '@/components/home/BannerCarousel'
import { HighValueStrip } from '@/components/home/HighValueStrip'
import { HomeCardGrid } from '@/components/home/HomeCardGrid'
import { HOME_NOTICE_COUNT, HOME_PINNED_COUNT, HomeNotices } from '@/components/home/HomeNotices'
import {
  getAnnouncements,
  getBanners,
  getCards,
  getFacets,
  getHighValueCards,
} from '@/lib/data'
import { parseCardSearch, type CardSearchParams } from '@/lib/card-search'
import { DEFAULT_LOCALE, LOCALES, localizeHref, type Locale } from '@/lib/i18n/locales'
import { absUrl, getOrigin } from '@/lib/site-url'
import { getTranslator } from '@/lib/i18n/t'

/** 首页卡牌网格每页数量：上面要露出 banner 与公告，因此比列表页的 24 少。 */
const HOME_PAGE_SIZE = 12

type Props = {
  params: Promise<{ locale: string }>
  searchParams?: Promise<CardSearchParams>
}

export const dynamic = 'force-dynamic'

// generateMetadata 与页面本体都要读 banner（封面图），按请求合并成一次查询。
const loadBanners = cache(() => getBanners())

/**
 * 首页 meta：用 LOCALES 里那条完整的站点标题与描述（不是「站名 + 页名」的组合），
 * 因为首页就是站点入口本身。canonical 始终落在 `/`：筛选只改查询串，
 * 把十几种筛法算成十几种重复内容对索引只有害处。
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params
  if (!(raw in LOCALES)) notFound()
  const locale = raw as Locale
  const origin = await getOrigin()
  const url = await absUrl('/', locale)
  const { title, description } = LOCALES[locale]
  const [first] = await loadBanners()
  const cover = first?.image?.bannerUrl || first?.image?.url

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
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
// 首页不分页：只露第一屏的 12 张，更多走 `/cards` 的「全部 →」，故不带 `withPage`。
function parseHomeQuery(sp: CardSearchParams) {
  return parseCardSearch(sp, { limit: HOME_PAGE_SIZE })
}

export default async function Page({ params, searchParams }: Props) {
  const { locale: raw } = await params
  if (!(raw in LOCALES)) notFound()
  const locale = raw as Locale
  const t = getTranslator(locale)
  const query = parseHomeQuery((await searchParams) ?? {})

  const [banners, notices, highValue, facets, catalog] = await Promise.all([
    loadBanners(),
    // 首页最多 5 条，其中置顶最多 2 条；其余名额用发布时间最新的公告补满。
    getAnnouncements({ limit: HOME_NOTICE_COUNT, maxPinned: HOME_PINNED_COUNT }),
    getHighValueCards(10),
    // 筛选维度的完整四层（IP → 系列 → 子系列 + 稀有度）：首页用的筛选栏与 /cards 是同一个。
    getFacets(),
    getCards(query),
  ])

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
          <HomeCardGrid cards={catalog.items} locale={locale} />
        </CatalogFilters>
      </section>

      {catalog.total > catalog.items.length && (
        // 只露 12 张时给一个出口，否则用户会以为全站就这么点卡。
        <div className="text-center">
          <Link
            href={localizeHref('/cards', locale)}
            className="inline-flex h-10 items-center rounded-lg border border-border-strong px-4 text-sm text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
          >
            {t('browseCards')} →
          </Link>
        </div>
      )}
    </div>
  )
}
