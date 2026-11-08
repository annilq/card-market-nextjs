'use client'

// 客户端组件拿语言的唯一途径：I18nProvider 把「URL 当前的界面语言」放进 context，
// 之后任意深度的客户端组件用 useT() 取翻译函数，不需要层层传参。
import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

import { DEFAULT_LOCALE, LOCALES, localeFromPathname, type Locale } from './locales'
import { getTranslator, type Translator } from './t'

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

/**
 * 语言是 URL 首段的纯函数。根布局在客户端 router.push 换语言时不会重渲染（共享布局
 * 被保留），若把语言作为道具从服务端下发，它会一直停在首次进站的语言，导致顶栏语言
 * select 与所有 useT() 文案都不跟着切。因此以 usePathname()（随路由变化触发重渲染）为准。
 *
 * bare `/` 与 rewrite 后的 `/zh` 都解析成 zh，SSR 与客户端结果一致，不会水合不一致；
 * 无语言段的路径（含非法段 `/de/...` 的 404）回退到默认语言，与 middleware 的 x-locale 一致。
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const locale = localeFromPathname(pathname) ?? DEFAULT_LOCALE

  // <html lang> 由服务端根布局渲染，客户端换语言时那个布局不重渲染；这里补一次，
  // 否则读屏软件在切到日语后仍按中文发音规则朗读。首屏值与 SSR 一致，effect 不会改动。
  useEffect(() => {
    document.documentElement.lang = LOCALES[locale].htmlLang
  }, [locale])

  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function useLocale(): Locale {
  return useContext(LocaleContext)
}

export function useT(): Translator {
  return getTranslator(useLocale())
}
