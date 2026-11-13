'use client'

// 卡牌目录的筛选、排序与结果工具条。
//
// 这个组件不持有任何筛选值：它从 `useSearchParams()` 读，改筛选就是改 URL，
// 刷新、分享链接、前进后退因此全部落在同一处（PRODUCT.md「URL 是状态」）。
// 这是移植时唯一不能妥协的一条——把筛选放进 useState，分享出去的链接就只是一页空列表。
//
// URL 参数名（与 `cards/page.tsx` 的解析必须一致，否则分享出去的链接等于换了一门语言）：
//   ip / series / sub / rarity  多选 ID，逗号分隔（也接受重复参数 ip=1&ip=2）
//   status                      卡牌状态 ID，逗号分隔
//   hv=1                        只看高价买取
//   min / max                   价格区间
//   q                           关键词（由顶栏搜索带入，这里只负责保留）
//   sort                        排序，取值见 CARD_SORTS
//   page                        页码（筛选变化一律回到第 1 页，故只由分页链接写入）
import { useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { FilterSheet } from './FilterSheet'
import {
  HomeFilterSheet,
  type HomeFilterField,
  type HomeFilterOption,
} from './HomeFilterSheet'
import { useDialog } from '@/lib/use-dialog'
import { useLocale, useT } from '@/lib/i18n/client'
import { localizeHref } from '@/lib/i18n/locales'
import {
  CARD_SORTS,
  DEFAULT_CARD_SORT,
  type CardSort,
  type FacetView,
} from '@/lib/types'

const PARAM = {
  ip: 'ip',
  series: 'series',
  sub: 'sub',
  rarity: 'rarity',
  status: 'status',
  highValue: 'hv',
  min: 'min',
  max: 'max',
  q: 'q',
  sort: 'sort',
  page: 'page',
} as const

type MultiKey = 'ip' | 'series' | 'sub' | 'rarity'

const VALUE_FIELD: Record<MultiKey, 'ipIds' | 'seriesIds' | 'subSeriesIds' | 'rarityIds'> = {
  ip: 'ipIds',
  series: 'seriesIds',
  sub: 'subSeriesIds',
  rarity: 'rarityIds',
}

export interface CatalogFilterValue {
  ipIds: number[]
  seriesIds: number[]
  subSeriesIds: number[]
  rarityIds: number[]
  cardStatusIds: number[]
  highValueOnly: boolean
  minPrice?: number
  maxPrice?: number
  q?: string
  sort: CardSort
}

export interface CatalogFacets {
  ips: FacetView[]
  series: FacetView[]
  subSeries: FacetView[]
  rarities: FacetView[]
  cardStatuses: FacetView[]
}

/**
 * 两种排布：
 * - `sidebar`（默认，`/cards`）：左侧常驻筛选栏 + 右侧结果列。
 * - `home`（首页）：没有侧栏的位置，因此把同一份筛选收进一行工具条 + 右侧面板，
 *   并在工具条下面补一排「已选条件」chips。
 *
 * 两者读写的 URL 参数完全一致（这也是它能被两处复用的唯一理由）：
 * 分面在这两个页面上必须是同一门语言，否则从首页筛完分享出去的链接到 /cards 就变了意思。
 */
export type CatalogFiltersLayout = 'sidebar' | 'home'

const idsOf = (sp: URLSearchParams, key: string): number[] => {
  // 同时接受 `ip=1&ip=2` 与 `ip=1,2`：前者是表单与手写链接的自然形态，
  // 后者是分享时的紧凑形态，两种都读，写入只用逗号（少一个参数、好读）。
  const raw = sp.getAll(key).join(',')
  if (!raw) return []
  const nums = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
  return Array.from(new Set(nums))
}

const firstOf = (sp: URLSearchParams, key: string): string | undefined => {
  const raw = sp.get(key)
  return raw == null || raw === '' ? undefined : raw
}

const numOf = (sp: URLSearchParams, key: string): number | undefined => {
  const raw = firstOf(sp, key)
  if (raw == null) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

function readValue(sp: URLSearchParams): CatalogFilterValue {
  const rawSort = firstOf(sp, PARAM.sort)
  return {
    ipIds: idsOf(sp, PARAM.ip),
    seriesIds: idsOf(sp, PARAM.series),
    subSeriesIds: idsOf(sp, PARAM.sub),
    rarityIds: idsOf(sp, PARAM.rarity),
    cardStatusIds: idsOf(sp, PARAM.status),
    highValueOnly: firstOf(sp, PARAM.highValue) != null,
    minPrice: numOf(sp, PARAM.min),
    maxPrice: numOf(sp, PARAM.max),
    q: firstOf(sp, PARAM.q),
    sort:
      rawSort && CARD_SORTS.includes(rawSort as CardSort)
        ? (rawSort as CardSort)
        : DEFAULT_CARD_SORT,
  }
}

type Patch = Record<string, string | null>

/** 一枚活跃筛选 chip：`patch` 是移除它时要写回 URL 的那几个键。 */
interface Chip {
  key: string
  label: string
  patch: Patch
}

export function CatalogFilters({
  facets,
  total,
  empty = false,
  children,
  layout = 'sidebar',
}: {
  facets: CatalogFacets
  /** 当前条件下的卡牌总数（工具条上「共 N 张」）。 */
  total: number
  /** 结果为空：由调用方判断（读数据的是服务端，组件不该自己猜）。 */
  empty?: boolean
  /** 服务端渲染好的结果网格（含分页）。筛选与排序都在客户端，结果本身不下沉。 */
  children?: ReactNode
  /** 排布：`sidebar`（默认，/cards）或 `home`（首页工具条 + 面板 + chips）。 */
  layout?: CatalogFiltersLayout
}) {
  const t = useT()
  const locale = useLocale()
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const value = readValue(sp)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // 首页面板当前开的是哪一个筛选（三个筛选共用一个面板）
  const [homeField, setHomeField] = useState<HomeFilterField | null>(null)
  // 只在「用户改过筛选」之后才播入场动画。首屏不播：页面加载时整块淡入属于
  // 加载编排，Read/Operate 面不该有；而且 SSR 首帧若先透明再淡入，慢网络上会读成内容在闪。
  const [changed, setChanged] = useState(false)

  /**
   * 写 URL：拷贝当前全部参数后只覆盖传进来的键，因此其它筛选、关键词、
   * 乃至外部带来的参数（utm_* 之类）都得以保留。
   * `scroll: false`——勾一个分面只该换结果，不该把视口拽回页顶；
   * 筛选栏桌面常驻、手机是折叠面板，用户滚到列表中部再改筛选时回页顶等于丢掉浏览位置。
   */
  const push = (patch: Patch) => {
    setChanged(true)
    const next = new URLSearchParams(sp.toString())
    for (const [key, v] of Object.entries(patch)) {
      if (v == null || v === '') next.delete(key)
      else next.set(key, v)
    }
    // 条件变了，原来的第 3 页在新条件下可能不存在，一律回到第 1 页。
    next.delete(PARAM.page)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const toggleMulti = (key: MultiKey, id: number) => {
    const cur = new Set(value[VALUE_FIELD[key]])
    if (cur.has(id)) cur.delete(id)
    else cur.add(id)
    const patch: Patch = {
      [PARAM[key]]: cur.size ? Array.from(cur).join(',') : null,
    }

    // 级联清理：取消 IP → 清其下系列与子系列；取消系列 → 清其下子系列。
    // 不清理的话，URL 里会留下一个「父级没选、子级还勾着」的条件，结果集看着像随机。
    if (key === 'ip' && !cur.has(id)) {
      const removedSeries = new Set(
        facets.series.filter((s) => s.parentId === id).map((s) => s.id),
      )
      const ns = new Set(value.seriesIds)
      removedSeries.forEach((s) => ns.delete(s))
      patch[PARAM.series] = ns.size ? Array.from(ns).join(',') : null

      const nsub = new Set(value.subSeriesIds)
      facets.subSeries
        .filter((ss) => ss.parentId != null && removedSeries.has(ss.parentId))
        .forEach((ss) => nsub.delete(ss.id))
      patch[PARAM.sub] = nsub.size ? Array.from(nsub).join(',') : null
    } else if (key === 'series' && !cur.has(id)) {
      const nsub = new Set(value.subSeriesIds)
      facets.subSeries.filter((ss) => ss.parentId === id).forEach((ss) => nsub.delete(ss.id))
      patch[PARAM.sub] = nsub.size ? Array.from(nsub).join(',') : null
    }

    push(patch)
  }

  const toggleStatus = (id: number) => {
    const cur = new Set(value.cardStatusIds)
    if (cur.has(id)) cur.delete(id)
    else cur.add(id)
    push({ [PARAM.status]: cur.size ? Array.from(cur).join(',') : null })
  }

  // 关键词与排序不算「筛选」：关键词来自顶栏搜索，是这次浏览的上下文；
  // 排序是看法而不是条件。清空只清条件，否则用户换个排序就得重输关键词。
  const clearAll = () =>
    push({
      [PARAM.ip]: null,
      [PARAM.series]: null,
      [PARAM.sub]: null,
      [PARAM.rarity]: null,
      [PARAM.status]: null,
      [PARAM.highValue]: null,
      [PARAM.min]: null,
      [PARAM.max]: null,
    })

  /**
   * 首页的「重置」：把查询串整个清空，回到「全部卡牌 + 默认排序」。
   * 它与上面 clearAll 的差别是故意的——/cards 上的关键词是用户刚搜出来的上下文，
   * 留着；首页的浅层浏览没有这层上下文，因此连 q 与 sort 一起回到默认。
   */
  const resetHome = () =>
    push({
      [PARAM.ip]: null,
      [PARAM.series]: null,
      [PARAM.sub]: null,
      [PARAM.rarity]: null,
      [PARAM.status]: null,
      [PARAM.highValue]: null,
      [PARAM.min]: null,
      [PARAM.max]: null,
      [PARAM.q]: null,
      [PARAM.sort]: null,
    })

  const ipSel = new Set(value.ipIds)
  const seriesSel = new Set(value.seriesIds)
  const subSel = new Set(value.subSeriesIds)
  const raritySel = new Set(value.rarityIds)
  const statusSel = new Set(value.cardStatusIds)

  const seriesEnabled = (s: FacetView) => ipSel.size === 0 || (s.parentId != null && ipSel.has(s.parentId))
  const subEnabled = (ss: FacetView) => {
    if (seriesSel.size > 0) return ss.parentId != null && seriesSel.has(ss.parentId)
    if (ipSel.size > 0) {
      const parent = facets.series.find((s) => s.id === ss.parentId)
      return parent ? parent.parentId != null && ipSel.has(parent.parentId) : false
    }
    return true
  }

  const hasFilter =
    value.ipIds.length +
      value.seriesIds.length +
      value.subSeriesIds.length +
      value.rarityIds.length +
      value.cardStatusIds.length >
      0 ||
    value.highValueOnly ||
    value.minPrice != null ||
    value.maxPrice != null ||
    !!value.q

  // 活跃筛选总数：筛选栏收起来时，这个数字是唯一的线索。
  const activeCount =
    value.ipIds.length +
    value.seriesIds.length +
    value.subSeriesIds.length +
    value.rarityIds.length +
    value.cardStatusIds.length +
    (value.highValueOnly ? 1 : 0) +
    (value.minPrice != null || value.maxPrice != null ? 1 : 0) +
    (value.q ? 1 : 0)

  // 「清空」只在真有可清的条件时出现。只带关键词（`q`）时按钮点了也不会变——
  // 一颗什么都不做的按钮比没有按钮更糟。
  const clearableCount =
    value.ipIds.length +
    value.seriesIds.length +
    value.subSeriesIds.length +
    value.rarityIds.length +
    value.cardStatusIds.length +
    (value.highValueOnly ? 1 : 0) +
    (value.minPrice != null || value.maxPrice != null ? 1 : 0)

  /**
   * 活跃筛选 chips：把 URL 里的条件摊成一个个可单独移除的标记。
   * 移除一项时的连带清理（去 IP 顺带去它的系列与子系列）与 `toggleMulti` 同一套规则——
   * 两条路径给出同一个结果，用户不必记住「移除」和「取消勾选」是两回事。
   */
  const chips: Chip[] = []
  const csvOrNull = (list: number[]): string | null => (list.length ? list.join(',') : null)
  const without = (list: number[], id: number) => list.filter((x) => x !== id)
  const nameOf = (items: FacetView[], id: number) => items.find((v) => v.id === id)?.name

  for (const id of value.ipIds) {
    const label = nameOf(facets.ips, id)
    if (!label) continue
    const droppedSeries = value.seriesIds.filter(
      (s) => facets.series.find((v) => v.id === s)?.parentId === id,
    )
    const seriesLeft = droppedSeries.reduce((acc, s) => without(acc, s), value.seriesIds)
    const subLeft = value.subSeriesIds.filter(
      (ss) => !droppedSeries.includes(facets.subSeries.find((v) => v.id === ss)?.parentId ?? -1),
    )
    chips.push({
      key: `ip:${id}`,
      label,
      patch: {
        [PARAM.ip]: csvOrNull(without(value.ipIds, id)),
        [PARAM.series]: csvOrNull(seriesLeft),
        [PARAM.sub]: csvOrNull(subLeft),
      },
    })
  }
  for (const id of value.seriesIds) {
    const label = nameOf(facets.series, id)
    if (!label) continue
    const subLeft = value.subSeriesIds.filter(
      (ss) => facets.subSeries.find((v) => v.id === ss)?.parentId !== id,
    )
    chips.push({
      key: `series:${id}`,
      label,
      patch: {
        [PARAM.series]: csvOrNull(without(value.seriesIds, id)),
        [PARAM.sub]: csvOrNull(subLeft),
      },
    })
  }
  for (const id of value.subSeriesIds) {
    const label = nameOf(facets.subSeries, id)
    if (label) {
      chips.push({ key: `sub:${id}`, label, patch: { [PARAM.sub]: csvOrNull(without(value.subSeriesIds, id)) } })
    }
  }
  for (const id of value.rarityIds) {
    const label = nameOf(facets.rarities, id)
    if (label) {
      chips.push({
        key: `rarity:${id}`,
        label,
        patch: { [PARAM.rarity]: csvOrNull(without(value.rarityIds, id)) },
      })
    }
  }
  for (const id of value.cardStatusIds) {
    const label = nameOf(facets.cardStatuses, id)
    if (label) {
      chips.push({ key: `status:${id}`, label, patch: { [PARAM.status]: csvOrNull(without(value.cardStatusIds, id)) } })
    }
  }
  if (value.highValueOnly) {
    chips.push({ key: 'hv', label: t('highValueOnly'), patch: { [PARAM.highValue]: null } })
  }
  if (value.minPrice != null || value.maxPrice != null) {
    // 价格区间合成一枚 chip：min 与 max 读起来是同一个条件的两端。
    const parts: string[] = []
    if (value.minPrice != null) parts.push(`${t('minPrice')} ${value.minPrice}`)
    if (value.maxPrice != null) parts.push(`${t('maxPrice')} ${value.maxPrice}`)
    chips.push({
      key: 'price',
      label: parts.join(' — '),
      patch: { [PARAM.min]: null, [PARAM.max]: null },
    })
  }
  if (value.q) {
    chips.push({ key: 'q', label: `「${value.q}」`, patch: { [PARAM.q]: null } })
  }

  // facet 上不做计数：Payload 不返回分面统计，硬凑一个数字不如只显示「已选 n」——
  // 不编造数字比显示一个错数字重要。
  const facetBody = (
    <div className="space-y-5">
      <Facet
        title={t('facetIp')}
        items={facets.ips}
        sel={ipSel}
        onToggle={(id) => toggleMulti('ip', id)}
      />
      <Facet
        title={t('facetSeries')}
        items={facets.series}
        sel={seriesSel}
        enabled={seriesEnabled}
        onToggle={(id) => toggleMulti('series', id)}
      />
      <Facet
        title={t('facetSubSeries')}
        items={facets.subSeries}
        sel={subSel}
        enabled={subEnabled}
        onToggle={(id) => toggleMulti('sub', id)}
      />
      <Facet
        title={t('facetRarity')}
        items={facets.rarities}
        sel={raritySel}
        onToggle={(id) => toggleMulti('rarity', id)}
      />

      {/* 卡牌状态来自后台 card-statuses 集合（facets.cardStatuses），与稀有度一样走 Facet 的 id 数组。 */}
      <Facet title={t('cardStatus')} items={facets.cardStatuses} sel={statusSel} onToggle={(id) => toggleStatus(id)} />

      <label className="flex min-h-9 items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={value.highValueOnly}
          onChange={(e) => push({ [PARAM.highValue]: e.target.checked ? '1' : null })}
        />
        {t('highValueOnly')}
      </label>

      <div className="space-y-1 text-sm">
        <div className="font-medium">{t('priceRange')}</div>
        <div className="flex items-center gap-2">
          <input
            // key 跟着 URL 里的值走：清空筛选后输入框才不会留着上一次的数字。
            key={`min:${value.minPrice ?? ''}`}
            type="number"
            inputMode="numeric"
            placeholder={t('minPrice')}
            defaultValue={value.minPrice ?? ''}
            aria-label={t('minPrice')}
            onBlur={(e) => push({ [PARAM.min]: e.target.value ? e.target.value : null })}
            className="w-full rounded-lg border border-border-strong px-2 py-1.5 bg-surface text-fg placeholder:text-faint outline-none transition-colors duration-150 focus:border-muted"
          />
          <span className="text-faint">—</span>
          <input
            key={`max:${value.maxPrice ?? ''}`}
            type="number"
            inputMode="numeric"
            placeholder={t('maxPrice')}
            defaultValue={value.maxPrice ?? ''}
            aria-label={t('maxPrice')}
            onBlur={(e) => push({ [PARAM.max]: e.target.value ? e.target.value : null })}
            className="w-full rounded-lg border border-border-strong px-2 py-1.5 bg-surface text-fg placeholder:text-faint outline-none transition-colors duration-150 focus:border-muted"
          />
        </div>
      </div>

      {clearableCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
        >
          {t('clearAll')}
        </button>
      )}
    </div>
  )

  const sortSelect = (
    <select
      value={value.sort}
      onChange={(e) => push({ [PARAM.sort]: e.target.value })}
      aria-label={t('filterSort')}
      className="h-9 rounded-lg border border-border-strong bg-surface px-2 text-sm text-fg outline-none transition-colors duration-150 hover:border-muted focus:border-muted"
    >
      <option value="price_desc">{t('sortPriceDesc')}</option>
      <option value="price_asc">{t('sortPriceAsc')}</option>
      <option value="newest">{t('sortNewest')}</option>
      <option value="oldest">{t('sortOldest')}</option>
    </select>
  )

  const emptyState = (
    <div className="rounded-xl border border-dashed border-border py-16 text-center">
      <p className="text-sm text-faint">{hasFilter ? t('emptyFiltered') : t('catalogEmpty')}</p>
      {clearableCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="mt-4 inline-flex items-center rounded-lg border border-border-strong px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          {t('clearAll')}
        </button>
      )}
    </div>
  )

  // 结果区（空态 or 网格 + 分页）：两种排布共用同一个。
  // key 跟着整条 query 走：换筛选时网格重挂载，`grid-enter` 播一次。
  const results = empty ? (
    emptyState
  ) : (
    <div key={sp.toString()} className={changed ? 'grid-enter' : ''}>
      {children}
    </div>
  )

  // 首页：IP tab 条（参考图那一排「宝可梦 / 海贼王」，右端带计数与 chips）
  // + 三个触发控件（分类 / 类型 / 排序）+ 结果。
  //
  // 与参考项目的唯一差别在 IpTab 的深色态（见它的注释）：参考项目那块浅粉
  // 在近黑底上是突兀的亮斑，且它配的文字色在两套主题下都只有 2.3:1。
  //
  // 首页是浅层浏览，因此这里**单选**：点一项即生效、生效即关闭面板。
  // 稀有度 / 价格区间 / 高价买取只在 /cards 的侧栏里——那页是检索，要能叠加条件。
  if (layout === 'home') {
    // 「分类」跟着 IP 收窄：选了宝可梦就只列宝可梦的主系列；
    // 没选 IP 时列全部，这样单用「分类」也能查。
    const ipId = value.ipIds.length === 1 ? value.ipIds[0] : undefined
    const seriesOptions = ipId
      ? facets.series.filter((s) => s.parentId === ipId)
      : facets.series

    const currentSeries = facets.series.find((s) => s.id === value.seriesIds[0])
    const currentSub = facets.subSeries.find((s) => s.id === value.subSeriesIds[0])
    const seriesText = currentSeries
      ? currentSub
        ? `${currentSeries.name} / ${currentSub.name}`
        : `${currentSeries.name} / ${t('facetAll')}`
      : t('facetAll')

    const typeText = facets.cardStatuses.find((s) => s.id === value.cardStatusIds[0])?.name ?? t('facetAll')

    const typeOptions: HomeFilterOption[] = [
      { value: '', label: t('facetAll') },
      ...facets.cardStatuses.map((s) => ({ value: String(s.id), label: s.name })),
    ]
    const sortOptions: HomeFilterOption[] = [
      { value: 'price_desc', label: t('sortPriceDesc') },
      { value: 'price_asc', label: t('sortPriceAsc') },
      { value: 'newest', label: t('sortNewest') },
      { value: 'oldest', label: t('sortOldest') },
    ]

    return (
      <div role="group" aria-label={t('catalogFilters')}>
        {/* IP 切换 tab：桌面(sm 及以上)左排 tab、右贴计数与「全部 →」；
            移动端改为「tab 横向滚动单行 + 右端一组落到下方靠右」，不再折行错位。 */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {facets.ips.length > 0 && (
            // tab 之间不留缝：设计图里这一排是连续的一条底带，缝隙会把它切成
            // 几颗孤立按钮，与 IpTab 注释里「整排读作一条带子」的意图相反。
            <div className="flex min-w-0 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:pb-0">
              <IpTab
                active={ipSel.size === 0}
                onClick={resetHome}
                label={t('facetAllIps')}
              />
              {facets.ips.map((ip) => (
                <IpTab
                  key={ip.id}
                  active={ipSel.has(ip.id)}
                  // 换 IP 连带清掉系列与子系列：新 IP 下它们多半不存在，
                  // 留着就是「已选但结果为空」的旧值。
                  onClick={() =>
                    push({
                      [PARAM.ip]: String(ip.id),
                      [PARAM.series]: null,
                      [PARAM.sub]: null,
                    })
                  }
                  label={ip.name}
                />
              ))}
            </div>
          )}
          {/* 右端一组：结果计数、已选条件、以及「全部 →」。
              设计图里分隔线下 30px 就是网格，计数不单独占一行，收进 tab 行右端。 */}
          {/*<div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 self-end sm:ml-auto sm:self-auto">
            <span className="text-sm text-muted tabular-nums">
              {t('catalogCount', { total })}
            </span>
            <FilterChips chips={chips} className="flex flex-wrap items-center justify-end gap-2" />
            <Link
              href={localizeHref('/cards', locale)}
              className="shrink-0 text-right text-sm text-muted transition hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
            >
              {t('viewAll')}
            </Link>
          </div>*/}
        </div>

        {/* 三个筛选做成触发控件：点一下，右侧滑出选择面板。
            移动端改为横向滚动单行；桌面(sm 及以上)按设计图改成「标签在上、值在下」，
            控件之间留大间距，并在整排下方画一条分隔线（结果从线下方开始）。
            「重置」始终在行尾、不随滚动被推走。 */}
        <div className="flex items-center gap-x-2 gap-y-1 sm:items-end sm:border-b sm:border-border-strong sm:pb-8">
          <div className="flex min-w-0 flex-1 gap-x-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:gap-x-32 sm:overflow-visible sm:pb-0">
          <FilterButton
            label={t('filterSeries')}
            current={seriesText}
            onClick={() => setHomeField('series')}
          />
          <FilterButton
            label={t('filterType')}
            current={typeText}
            onClick={() => setHomeField('type')}
          />
          <FilterButton
            label={t('filterSort')}
            current={sortOptions.find((o) => o.value === value.sort)?.label ?? t('sortPriceDesc')}
            onClick={() => setHomeField('sort')}
          />

          {/* 「重置」在这一排的末尾：改完筛选之后手就在这一带。
              没有可重置项时禁用而不是隐藏，按钮位置才不会在筛选前后跳动。 */}
          </div>

          {/*<button
            type="button"
            onClick={resetHome}
            disabled={clearableCount === 0 && value.sort === DEFAULT_CARD_SORT && !value.q}
            className="ml-auto shrink-0 whitespace-nowrap py-1 text-sm text-muted transition-colors duration-150 hover:text-fg hover:underline disabled:cursor-default disabled:text-faint disabled:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
          >
            {t('catalogReset')}
          </button>*/}
        </div>

        {/* 分隔线到网格 30px（设计图实测）。计数与 chips 已收进上方 tab 行右端。 */}
        <div className="mt-[30px]">{results}</div>

        {homeField && (
          <HomeFilterSheet
            field={homeField}
            title={
              homeField === 'series'
                ? t('filterSeries')
                : homeField === 'type'
                  ? t('filterType')
                  : t('filterSort')
            }
            series={seriesOptions}
            subSeries={facets.subSeries}
            value={{
              cardStatusId: value.cardStatusIds[0],
              seriesId: value.seriesIds[0],
              sort: value.sort,
              subSeriesId: value.subSeriesIds[0],
            }}
            options={homeField === 'type' ? typeOptions : sortOptions}
            onPick={(next) => {
              if ('seriesId' in next) {
                const seriesId = next.seriesId
                // 选了具体系列就把 IP 补成它的父级，两个控件不会互相矛盾
                const parentIp = seriesId
                  ? facets.series.find((v) => v.id === seriesId)?.parentId
                  : undefined
                push({
                  [PARAM.series]: seriesId ? String(seriesId) : null,
                  [PARAM.sub]: next.subSeriesId ? String(next.subSeriesId) : null,
                  ...(seriesId && parentIp ? { [PARAM.ip]: String(parentIp) } : {}),
                })
              } else if ('cardStatusId' in next) {
                push({ [PARAM.status]: next.cardStatusId != null ? String(next.cardStatusId) : null })
              } else if ('sort' in next) {
                push({ [PARAM.sort]: next.sort ?? null })
              }
            }}
            onClose={() => setHomeField(null)}
          />
        )}
      </div>
    )
  }

  return (
    // 右侧内容列用 minmax(0,1fr)：否则超长卡名/编号的 min-content 会顶宽整列。
    <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-6">
      {/* 桌面筛选栏：常驻、粘在头部下方。手机上整条轨道不渲染，
          改由内容列顶部的按钮唤起底部面板——否则「筛选」那一整块会在首屏
          占掉 ~120px，把第一张卡推到折线以下。 */}
      <aside className="hidden min-w-0 lg:sticky lg:top-20 lg:block lg:self-start">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">{t('filters')}</h2>
          {hasFilter && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted tabular-nums">
              {activeCount}
            </span>
          )}
        </div>
        {facetBody}
      </aside>

      <section id="card-grid" tabIndex={-1} className="min-w-0 scroll-mt-20 outline-none">
        {/* 工具条：筛选开关 + 结果计数 + 排序，一行 36px。
            手机首屏的第一张卡因此从约 300px 提到约 130px。 */}
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong px-3 text-sm text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg lg:hidden"
          >
            {t('filters')}
            {activeCount > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-on-accent tabular-nums">
                {activeCount}
              </span>
            )}
          </button>
          <span className="text-sm text-muted tabular-nums">{t('totalCount', { total })}</span>
          <div className="ml-auto">{sortSelect}</div>
        </div>

        {filtersOpen && (
          <FilterSheet title={t('filters')} onClose={() => setFiltersOpen(false)}>
            {facetBody}
          </FilterSheet>
        )}

        {results}
      </section>
    </div>
  )
}

function Facet({
  title,
  items,
  sel,
  enabled,
  onToggle,
}: {
  title: string
  items: FacetView[]
  sel: Set<number>
  enabled?: (item: FacetView) => boolean
  onToggle: (id: number) => void
}) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="font-medium text-sm mb-2">{title}</div>
      <div className="space-y-1 max-h-52 overflow-auto pr-1">
        {items.map((it) => {
          const isEnabled = enabled ? enabled(it) : true
          return (
            // 行高至少 24px（WCAG 2.5.8）：纯文字行只有 20px，手指点不准。
            <label
              key={it.id}
              className={`flex min-h-6 items-center gap-2 text-sm ${isEnabled ? '' : 'opacity-30'}`}
            >
              <input
                type="checkbox"
                checked={sel.has(it.id)}
                disabled={!isEnabled}
                onChange={() => onToggle(it.id)}
              />
              {it.name}
            </label>
          )
        })}
      </div>
    </div>
  )
}

/**
 * IP tab：整颗 40px 高、可一键切换，字用 20px（与参考项目一致）。
 * h-10 不是随意取的：参考图实测这一排 tab 从 y1476 到 1515；纯文字行只有 20px，
 * 低于 WCAG 2.5.8 的 24px，手指点不准。
 *
 * 未选中态是参考项目实测的浅粉（#F2E2E3）——它是这一排 tab 的「纸面」，
 * 与白色卡片区分开，整排因此读起来是一条带子而不是几个孤立的按钮。
 * 深色下换成中性半透明底：浅粉在近黑底上是一块突兀的亮斑，而它的文字色
 * （参考项目用的 gray-400，压在浅粉上只有 2.3:1）在两套主题下都偏浅，
 * 这里改用 muted / faint 语义色，两套主题各自达标。
 */
function IpTab({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        `inline-flex h-10 shrink-0 items-center px-5 text-xl transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted ` +
        (active
          ? 'bg-brand text-white'
          : 'bg-[#F2E2E3] text-muted hover:bg-[#f6dadc] hover:text-fg dark:bg-surface-2 dark:text-muted dark:hover:bg-border')
      }
    >
      {label}
    </button>
  )
}

/**
 * 触发控件：整颗是按钮，点击右滑出选择面板。
 *
 * 两种排布：
 * - 手机：标签与当前值同一行（40px 高、可横滑），维持原来的紧凑工具条；
 * - `sm` 及以上：按设计图改成上下布局——标签 18px 加粗，下一行是当前值 + 右侧
 *   chevron，没有底色/边框，三个控件之间留出大间距，整排读起来像表头而不是按钮。
 *   底部分隔线由外层容器画（见 home 分支），这里只负责文字。
 *
 * 上下布局用纯 CSS 断点切换，不依赖 JS 的 matchMedia：服务端首帧就是对的，
 * 不会出现先渲染手机版、水合后再跳成桌面版的抖动。
 */
function FilterButton({
  current,
  label,
  onClick,
}: {
  label: string
  current: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="inline-flex h-10 shrink-0 min-w-0 max-w-full items-center gap-1.5 rounded px-3 text-sm transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted sm:h-auto sm:flex-col sm:items-start sm:gap-1.5 sm:rounded-none sm:px-0 sm:py-0 sm:text-left sm:hover:bg-transparent"
    >
      <span className="shrink-0 font-bold text-fg sm:text-xl">{label}</span>
      <span className="flex min-w-0 max-w-full items-center gap-2 sm:gap-12">
        <span className="min-w-0 truncate text-muted sm:text-lg sm:text-body">{current}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          className="shrink-0 text-fg sm:size-[18px]"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </span>
    </button>
  )
}

/**
 * 已选条件 chips。每个 chip 点一下就移除它自己那一项。
 *
 * 为什么要有它：工具条上的「筛选」按钮只显示「已选 n」，下拉里只显示当前值，
 * 用户改了两处之后看不出结果为什么少了。chips 把答案放在结果计数旁边。
 */
function FilterChips({ chips, className }: { chips: Chip[]; className?: string }) {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  if (chips.length === 0) return null

  return (
    <ul className={className ?? 'mb-4 flex flex-wrap items-center gap-2'}>
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(sp.toString())
              for (const [key, v] of Object.entries(chip.patch)) {
                if (v == null) next.delete(key)
                else next.set(key, v)
              }
              next.delete(PARAM.page)
              const qs = next.toString()
              router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
            }}
            // 读屏要能听出「这是一枚可移除的条件」：视觉上的 × 号读出来是「乘」。
            // 三语文案各自给一条 filterRemove，占位符 {name} 由字典插值补齐。
            aria-label={t('filterRemove', { name: chip.label })}
            className="inline-flex min-h-6 items-center gap-1 rounded-full border border-border-strong bg-surface px-2.5 py-1 text-xs text-muted transition-colors duration-150 hover:border-fg hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
          >
            {chip.label}
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * 首页用的筛选面板：桌面右侧滑入（`sheet-in`），手机上占满宽度从右侧滑入。
 *
 * 与 `FilterSheet` 的差别只有一个且不改变内容：FilterSheet 带 `lg:hidden`
 * （它在 /cards 上是桌面侧栏的替身），首页没有侧栏，桌面也必须能打开它。
 */
function HomeFilterPanel({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const t = useT()
  const panelRef = useRef<HTMLDivElement>(null)
  // 面板只在 `{filtersOpen && ...}` 成立时挂载，故 open 恒为 true。
  useDialog({ open: true, onClose, containerRef: panelRef })

  return (
    <div className="fixed inset-0 z-999">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="sheet-fade absolute inset-0 bg-black/45"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        // 最高 90dvh：面板内部自己滚动，标题行与关闭按钮始终留在视野里。
        className="sheet-in absolute inset-y-0 right-0 flex max-h-[90dvh] w-[min(420px,92vw)] flex-col rounded-l-2xl bg-surface text-fg outline-none"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <span className="text-base font-bold">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('filterSheetClose')}
            className="inline-flex h-9 w-9 items-center justify-center rounded text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}
