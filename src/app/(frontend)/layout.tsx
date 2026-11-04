import type { Viewport, Metadata } from 'next'
import { cache } from 'react'
import type { ReactNode } from 'react'

import './globals.css'

import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { getSiteSettings } from '@/lib/data'
import { I18nProvider } from '@/lib/i18n/client'
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/i18n/locales'
import { getLocaleFromHeaders } from '@/lib/i18n/server'
import { getOrigin, absUrl } from '@/lib/site-url'

// 在首屏绘制前同步主题，避免浅色闪一下。优先级：localStorage > 系统偏好。
// 必须是**内联**脚本而不是 next/script：bundle 里的脚本最早也要等 HTML 解析到它
// 才执行，那时首屏已经画出来了。
const NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`

/** 部署后的站点地址。hreflang / canonical 必须是绝对地址，写相对路径爬虫会直接忽略。 */
// 线上走「请求 host」（见 src/lib/site-url），不依赖任何域名变量；本地 dev 回退 localhost。

/** 某种语言下「站点根」的绝对地址：默认语言不带前缀。 */
async function rootUrl(locale: Locale): Promise<string> {
  return absUrl('/', locale)
}

// generateMetadata 与布局本体都要读站点设置，用 React 的 cache 合并成一次查询。
const loadSiteSettings = cache(() => getSiteSettings())

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 移动端地址栏配色跟着主题走，避免深色下浏览器 UI 刺眼。
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1120' },
  ],
}

/**
 * 根布局只发「每页都有、与内容无关」的标签，外加一套**兜底**的 title/description。
 *
 * 各子页面自己的 generateMetadata 会覆盖这里（模板 `%s | 站名` 在下面给出）；
 * 留一份兜底是为了 404 / 500 这类没有叶子路由元数据的页面不至于没有标题。
 * Next 的 generateMetadata 拿不到 pathname，所以 canonical / hreflang 只能落到
 * 「各语言的站点根」——需要精确 canonical 的页面在自己的 generateMetadata 里重写。
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocaleFromHeaders()
  const settings = await loadSiteSettings()
  const meta = LOCALES[locale]
  const siteName = settings.siteName?.trim() || meta.title

  const origin = await getOrigin()
  const languages: Record<string, string> = {}
  for (const key of Object.keys(LOCALES) as Locale[]) {
    languages[LOCALES[key].htmlLang] = await rootUrl(key)
  }
  // 未匹配语言的访客（浏览器语言不在 zh/ja/en 内）落到默认语言。
  languages['x-default'] = await rootUrl(DEFAULT_LOCALE)

  return {
    // 有了 metadataBase，子页面里写相对路径的 og:image / alternates 也会变成绝对地址。
    metadataBase: new URL(origin),
    title: {
      default: meta.title,
      template: `%s | ${siteName}`,
    },
    description: meta.description,
    // 卡牌编号容易被 iOS 识别成电话号码。
    formatDetection: { telephone: false },
    alternates: {
      canonical: await rootUrl(locale),
      languages,
    },
    openGraph: {
      type: 'website',
      siteName,
      locale: meta.intl,
      title: meta.title,
      description: meta.description,
      url: await rootUrl(locale),
    },
    twitter: {
      card: 'summary',
      title: meta.title,
      description: meta.description,
    },
  }
}

/**
 * 前端根布局，也是唯一渲染 <html> 的地方（`[locale]` 下没有再套一层文档外壳）。
 * 404 / 500 也走这里，因此它们只需给出 main 里的内容。
 */
export default async function FrontendLayout({ children }: { children: ReactNode }) {
  const locale = await getLocaleFromHeaders()
  const settings = await loadSiteSettings()

  return (
    // suppressHydrationWarning：无闪烁脚本会在 React 之前改动 <html> 的 class。
    <html lang={LOCALES[locale].htmlLang} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <I18nProvider locale={locale}>
          <SiteHeader settings={settings} />
          <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6">{children}</main>
          <SiteFooter settings={settings} />
        </I18nProvider>
      </body>
    </html>
  )
}
