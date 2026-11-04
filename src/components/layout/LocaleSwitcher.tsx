'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { LOCALES, localizeHref, type Locale } from '@/lib/i18n/locales'
import { useLocale, useT } from '@/lib/i18n/client'

// 收起状态只放短标签（中 / 日 / EN）：320px 顶栏里三颗满标签链接会溢出 59px，
// 单颗 select 收到 56px 才能塞下；<option> 是系统白底面板，另用深色文字。
const SHORT_LOCALE_LABEL: Record<Locale, string> = {
  zh: '中',
  ja: '日',
  en: 'EN',
}

const LOCALE_KEYS = Object.keys(LOCALES) as Locale[]

/**
 * 语言切换：留在当前页面，只换 URL 里的语言段。
 *
 * 桌面与移动统一用一颗原生 `<select>`：三个语言（中 / 日 / EN）
 * 收进一个下拉控件，而不是排成三颗按钮。下拉面板由系统渲染（白底），
 * 所以 `<option>` 用深色文字；收起状态压在红色顶栏上，用白色文字 + 描边。
 *
 * 用受控 `<select>` + `router.push` 跳转：意图是「把同一页换成另一种界面语言」，
 * 查询串（含列表筛选态）一起带过去。需要 JS 才能跳——对语言切换这是可接受的取舍。
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
    <select
      aria-label={t('switchLanguage')}
      value={locale}
      onChange={(event) => router.push(hrefFor(event.target.value as Locale))}
      className="h-9 w-14 rounded border border-white/40 bg-transparent px-2 text-sm text-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-20"
    >
      {LOCALE_KEYS.map((key) => (
        // 下拉面板是系统渲染的白底，所以选项文字要深色
        <option key={key} value={key} className="bg-white text-black">
          {SHORT_LOCALE_LABEL[key]}
        </option>
      ))}
    </select>
  )
}
