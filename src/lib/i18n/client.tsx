'use client'

// 客户端组件拿语言的唯一途径：根布局把当前语言放进 context，
// 之后任意深度的客户端组件用 useT() 取翻译函数，不需要层层传参。
import { createContext, useContext, type ReactNode } from 'react'

import { DEFAULT_LOCALE, type Locale } from './locales'
import { getTranslator, type Translator } from './t'

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function useLocale(): Locale {
  return useContext(LocaleContext)
}

export function useT(): Translator {
  return getTranslator(useLocale())
}
