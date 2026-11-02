// 服务端组件读语言：middleware 把解析结果放进 x-locale 请求头，
// 这样根布局（拿不到 [locale] 参数）也能正确写出 <html lang>。
import { headers } from 'next/headers'

import { DEFAULT_LOCALE, LOCALES, resolveLocaleParam } from './locales'
import type { Locale } from './locales'

export function normalizeLocale(raw: string | null | undefined): Locale {
  if (!raw) return DEFAULT_LOCALE
  if (raw in LOCALES) return raw as Locale
  return resolveLocaleParam(raw) ?? DEFAULT_LOCALE
}

/** 根布局专用：从请求头取当前语言。 */
export async function getLocaleFromHeaders(): Promise<Locale> {
  const h = await headers()
  return normalizeLocale(h.get('x-locale'))
}
