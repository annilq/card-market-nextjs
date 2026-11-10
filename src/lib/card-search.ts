// URL 查询串 → `CardQuery` 的唯一解析入口。
//
// 首页与 `/cards` 是同一套筛选栏的两处落点（见 `CatalogFilters`），因此参数名
// 必须只有一门语言，解析也必须只有一份实现：两处各写一遍，改一处忘一处时
// 分享出去的链接就会换意思。
//
// 参数表（读两写法、写只写逗号）：
//   ip / series / sub / rarity  多选 ID，逗号分隔（也接受重复参数 `ip=1&ip=2`）
//   status                      卡牌状态 ID，逗号分隔
//   hv=1                        只看高价买取
//   min / max                   价格区间
//   q                           关键词（由顶栏搜索带入，这里只负责读出来）
//   sort                        排序，取值见 CARD_SORTS
//   page                        页码（只有 `/cards` 读，首页不分页）
//
// 这里全是纯函数、不含 React，服务端页面直接调用。

import {
  CARD_SORTS,
  DEFAULT_CARD_SORT,
  type CardQuery,
  type CardSort,
} from '@/lib/types'

/** Next 的 `searchParams`（await 之后的形状）。 */
export type CardSearchParams = Record<string, string | string[] | undefined>

/**
 * 取一个参数的原始值。
 * 重复参数（`ip=1&ip=2`）在这里并成逗号串，后面的解析因此只需认一种形态。
 */
export const rawOf = (sp: CardSearchParams, key: string): string | undefined => {
  const v = sp[key]
  if (v == null) return undefined
  const joined = Array.isArray(v) ? v.filter((s) => s !== '').join(',') : v
  return joined === '' ? undefined : joined
}

/** 多选 ID：过滤掉非正整数并去重，空则 undefined（「没选」与「选了空集」同义）。 */
export const idListOf = (sp: CardSearchParams, key: string): number[] | undefined => {
  const raw = rawOf(sp, key)
  if (!raw) return undefined
  const ids = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
  if (!ids.length) return undefined
  return Array.from(new Set(ids))
}

export const numOf = (sp: CardSearchParams, key: string): number | undefined => {
  const raw = rawOf(sp, key)
  if (raw == null) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

/** 写入 URL 时的逗号串：空列表写成 null（= 删掉这个参数）。 */
export const csvOrNull = (list?: readonly (string | number)[] | null): string | null =>
  list?.length ? list.join(',') : null

export interface CardSearchOptions {
  /** 每页条数。两个页面不同（`/cards` 24、首页 12），因此由调用方给。 */
  limit: number
  /**
   * 是否解析 `page`。首页不分页（只露第一屏，更多走 `/cards`），
   * 传 false 时返回的 CardQuery 里不带 `page`。
   */
  withPage?: boolean
}

/** searchParams → CardQuery。两个列表页共用这一份。 */
export function parseCardSearch(
  sp: CardSearchParams,
  { limit, withPage = false }: CardSearchOptions,
): CardQuery {
  const rawSort = rawOf(sp, 'sort')
  const rawPage = numOf(sp, 'page')

  const base: CardQuery = {
    ipIds: idListOf(sp, 'ip'),
    seriesIds: idListOf(sp, 'series'),
    subSeriesIds: idListOf(sp, 'sub'),
    rarityIds: idListOf(sp, 'rarity'),
    cardStatusIds: idListOf(sp, 'status'),
    highValueOnly: rawOf(sp, 'hv') != null,
    minPrice: numOf(sp, 'min'),
    maxPrice: numOf(sp, 'max'),
    q: rawOf(sp, 'q'),
    sort:
      rawSort && CARD_SORTS.includes(rawSort as CardSort)
        ? (rawSort as CardSort)
        : DEFAULT_CARD_SORT,
  }

  return withPage
    ? { ...base, page: rawPage != null ? Math.max(1, Math.floor(rawPage)) : 1, limit }
    : { ...base, limit }
}
