'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { LOCALES, localizeHref, type Locale } from '@/lib/i18n/locales'
import { useLocale, useT } from '@/lib/i18n/client'

// 手机顶栏空间只够一个短标签。可见文字是「中 / 日 / EN」，
// 屏幕阅读器读到的是 <a> 的可访问名（语言全称），两者由 CSS 分工。
const SHORT_LOCALE_LABEL: Record<Locale, string> = {
  zh: '中',
  ja: '日',
  en: 'EN',
}

const LOCALE_KEYS = Object.keys(LOCALES) as Locale[]

const btn =
  'inline-flex h-9 min-w-9 items-center justify-center rounded px-2 text-sm transition outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

/**
 * 语言切换：留在当前页面，只换 URL 里的语言段。
 *
 * 用 `<Link>` 而不是 router.push：没有 JS 时它就是一个普通链接，
 * 而意图是「把同一页换成另一种界面语言」，本来就该是一个可跳转的地址。
 * 查询串（含列表筛选态）一起带过去。
 */
export function LocaleSwitcher() {
  const locale = useLocale()
  const t = useT()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  /**
   * 当前路径换成目标语言的地址。
   *
   * usePathname() 的返回值取决于 rewrite 有没有被还原：可能是带语言的
   * `/ja/cards`，也可能是不带的 `/cards`（默认语言由 middleware rewrite 到
   * `/zh/...`）。两种都先把第一段按「已知语言」剥掉，再重新补，就不会叠成
   * `/ja/zh/cards`；反过来，第一段不是已知语言（如 `cards`）时也不动它。
   */
  const hrefFor = (target: Locale): string => {
    const segments = pathname.split('/').filter(Boolean)
    const first = segments[0]
    const rest = first && first in LOCALES ? segments.slice(1) : segments
    const bare = rest.length ? `/${rest.join('/')}` : '/'
    const localized = localizeHref(bare, target)
    const search = searchParams.toString()
    return search ? `${localized}?${search}` : localized
  }

  return (
    <>
      {/*
        <768：原生 <select>，形态照参考项目的「compact」——宽度收到 w-14、
        选项用短标签（中 / 日 / EN）。三个语言链接在 320px 顶栏里要 116px，
        加上 logo 与图标组就横向溢出（实测 320px 溢出 59px）；select 只占 56px。
        它需要 JS 才能跳——在手机上这是可接受的取舍，桌面仍然是纯链接。

        短标签是可访问名的一部分：整颗 select 有 aria-label（切换语言），
        选项本身读到的是「中 / 日 / EN」，与屏幕上看到的一致。
      */}
      <select
        aria-label={t('switchLanguage')}
        value={locale}
        onChange={(event) => router.push(hrefFor(event.target.value as Locale))}
        className="h-9 w-14 rounded border border-white/40 bg-transparent pl-2 pr-1 text-sm text-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:hidden"
      >
        {LOCALE_KEYS.map((key) => (
          // 下拉面板是系统渲染的白底，所以选项文字要深色
          <option key={key} value={key} className="text-black">
            {SHORT_LOCALE_LABEL[key]}
          </option>
        ))}
      </select>

      <nav aria-label={t('switchLanguage')} className="hidden items-center gap-1 md:flex">
        {LOCALE_KEYS.map((key) => {
          const current = key === locale
          return (
            <Link
              key={key}
              href={hrefFor(key)}
              hrefLang={LOCALES[key].htmlLang}
              aria-current={current ? 'true' : undefined}
              className={`${btn} ${
                current
                  ? 'bg-white/15 font-semibold text-white'
                  : 'text-white/85 hover:bg-white/10 hover:text-white'
              }`}
            >
              {/* <1024 显示短标签，桌面显示全称。两个 span 同时渲染，不依赖 JS。 */}
              <span className="lg:hidden">{SHORT_LOCALE_LABEL[key]}</span>
              <span className="hidden lg:inline">{LOCALES[key].label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
