import Link from 'next/link'

import { DEFAULT_LOCALE, LOCALES, localizeHref, type Locale } from '@/lib/i18n/locales'
import { getTranslator } from '@/lib/i18n/t'

/** 剥掉可能的语言段：`/ja/cards/1` → `/cards/1`。 */
function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  const first = segments[0]
  const rest = first && first in LOCALES ? segments.slice(1) : segments
  return rest.length ? `/${rest.join('/')}` : '/'
}

/**
 * 哪些路由真的会渲染后台内容（源站口径）。
 * 留言表单与 404 全是界面文案，在那里挂一条「内容是中文的」只会误导。
 */
function showsCmsContent(bare: string): boolean {
  return (
    bare === '/' ||
    bare.startsWith('/cards') ||
    bare.startsWith('/announcements') ||
    bare.startsWith('/shops') ||
    bare.startsWith('/info/')
  )
}

/**
 * 内容语言说明（服务端组件）。
 *
 * 界面是多语言的（导航、按钮、标签都跟着 URL 语言段走），但**后台内容是单一语言的**：
 * 卡牌名、公告正文、门店地址、信息页正文都来自同一条记录，不随语言段变化。
 * 所以日语/英语页面上「界面是日语、内容却是中文」不是 bug，是一条需要说明的边界。
 *
 * @param pathname 可选。传了就按源站的路由口径过滤（只在渲染后台内容的页面上出现），
 *   并且「查看原文」链接会精确指向当前页；Next 没有把 pathname 暴露给服务端组件，
 *   所以不传时按调用方「只在这类页面上挂载」来处理，链接回落到首页。
 */
export function ContentLanguageNotice({ locale, pathname }: { locale: Locale; pathname?: string }) {
  const t = getTranslator(locale)

  if (locale === DEFAULT_LOCALE) return null

  const given = pathname?.trim() ?? ''
  const bare = given ? stripLocalePrefix(given) : '/'
  if (given && !showsCmsContent(bare)) return null

  // 切到默认语言的同一路径。查询串不跟过去——这条链接的用途是「看原文」。
  const target = localizeHref(bare, DEFAULT_LOCALE)

  return (
    <p className="mb-6 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted">
      {t('contentLanguageNotice')}{' '}
      <Link href={target} hrefLang={LOCALES[DEFAULT_LOCALE].htmlLang} className="underline hover:text-fg">
        {t('contentLanguageSwitch')}
      </Link>
    </p>
  )
}
