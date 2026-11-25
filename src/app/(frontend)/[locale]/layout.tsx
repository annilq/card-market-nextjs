// 语言段布局：顶栏 / 内容列 / 页脚。
//
// 为什么不放在 `(frontend)/layout.tsx`：根布局在 `[locale]` 段之上，客户端切换语言
// （`/` → `/zh`）时 Next 会保留共享布局、不会重新渲染它，顶栏和页脚的文案就会停在
// 旧语言——这正是「切到日文后页脚仍是中文」的原因。放在 `[locale]` 段里后，语言段
// 变化会让本布局重新渲染，服务端按新语言输出顶栏与页脚。
//
// 语言直接取自本段参数，不再读 middleware 的 x-locale：`/de/...` 这类非法段会让
// 页面自己 404，外壳先按默认语言渲染，保证 404 也带顶栏页脚。
import type { ReactNode } from 'react'

import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { getSiteSettings } from '@/lib/data'
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/i18n/locales'

type Props = {
  children: ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale: raw } = await params
  const locale: Locale = raw in LOCALES ? (raw as Locale) : DEFAULT_LOCALE
  const settings = await getSiteSettings()

  return (
    <>
      <SiteHeader settings={settings} locale={locale} />
      {/* 1232 = 设计图内容列 1200 + 两侧各 16 的留白（px-4）。 */}
      <main className="mx-auto w-full max-w-[1232px] flex-1 px-4 py-3 md:py-6">{children}</main>
      <SiteFooter settings={settings} locale={locale} />
    </>
  )
}
