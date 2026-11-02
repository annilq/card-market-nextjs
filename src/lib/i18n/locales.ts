// 语言注册表：一条记录对应一种界面语言。新增语言只需在这里加一行，
// 并在 messages.ts 里补齐 Record<MessageKey, string>（类型系统会强制补全）。
//
// DEFAULT_LOCALE 是「无前缀」的那一种：`/cards` 服务 zh，`/ja/cards` 服务 ja。
// 因此 zh 的 URL 不带段，其余语言都带。

export const LOCALES = {
  zh: {
    label: '中文',
    htmlLang: 'zh-CN',
    intl: 'zh-CN',
    prefix: '',
    title: '卡牌展示与回购信息',
    description: 'TCG 卡牌展示与高价回购信息站：按 IP、系列筛选，查看门店与公告。',
  },
  ja: {
    label: '日本語',
    htmlLang: 'ja-JP',
    intl: 'ja-JP',
    prefix: 'ja',
    title: 'カード展示・買取情報',
    description: 'TCG カードの展示と高価買取情報。IP・シリーズで絞り込み、店舗とお知らせを確認できます。',
  },
  en: {
    label: 'English',
    htmlLang: 'en',
    intl: 'en-US',
    prefix: 'en',
    title: 'Card showcase and buyback info',
    description: 'Trading card showcase and premium buyback info. Filter by IP and series, browse stores and news.',
  },
} as const

export type Locale = keyof typeof LOCALES

export const DEFAULT_LOCALE: Locale = 'zh'

const BY_PREFIX = new Map<string, Locale>(
  Object.entries(LOCALES)
    .filter(([, meta]) => meta.prefix !== '')
    .map(([locale, meta]) => [meta.prefix, locale as Locale]),
)

/**
 * 把 URL 里的语言段解析成受支持的语言。
 * 唯一的边界解析点：未知或不支持的值一律落到 null，由调用方决定 404 还是重定向。
 */
export function resolveLocaleParam(raw: string | undefined): Locale | null {
  if (raw == null) return DEFAULT_LOCALE
  return BY_PREFIX.get(raw) ?? null
}

export function isDefaultLocale(locale: Locale): boolean {
  return locale === DEFAULT_LOCALE
}

/**
 * 给站内路径补上语言段。用于「路径来自后台内容」的场景（如 banner 的 link），
 * 这类值绕过了路由类型系统，只能在这里补齐，否则从日语页点进去会掉回默认语言。
 * 已带受支持语言段的路径原样返回；外链（非 `/` 开头）也原样返回。
 */
export function localizeHref(href: string, locale: Locale): string {
  if (!href.startsWith('/')) return href
  const prefix = LOCALES[locale].prefix
  if (!prefix) return href
  const firstSegment = href.split('/')[1] ?? ''
  if (BY_PREFIX.has(firstSegment)) return href
  return href === '/' ? `/${prefix}` : `/${prefix}${href}`
}
