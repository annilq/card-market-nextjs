// 语言无关的翻译工厂：服务端组件与客户端组件共用同一份实现。
// 语言在运行时的唯一来源是 URL 路径段（middleware 负责把默认语言映射到 /zh），
// 因此不存在「服务端渲染一种语言、水合后变成另一种」的闪变。
import { LOCALES } from './locales'
import type { Locale } from './locales'
import { translate } from './messages'
import type { MessageKey, MessageVars } from './messages'

export { LOCALES, DEFAULT_LOCALE, localizeHref, resolveLocaleParam } from './locales'
export type { Locale } from './locales'
export type { MessageKey, MessageVars } from './messages'

export interface Translator {
  (key: MessageKey, vars?: MessageVars): string
  locale: Locale
}

const CACHE = new Map<Locale, Translator>()

/** 同一语言下引用稳定，可以直接进依赖数组。 */
export function getTranslator(locale: Locale): Translator {
  const cached = CACHE.get(locale)
  if (cached) return cached
  const t = ((key: MessageKey, vars?: MessageVars) => translate(locale, key, vars)) as Translator
  t.locale = locale
  CACHE.set(locale, t)
  return t
}

/** 按语言格式化日期，固定 Asia/Tokyo 时区避免 SSR 与浏览器的时区抖动。 */
export function formatDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(LOCALES[locale].intl, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  }).format(date)
}
