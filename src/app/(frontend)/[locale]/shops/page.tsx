import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ContentLanguageNotice } from '@/components/ContentLanguageNotice'
import { ShopList } from '@/components/shops/ShopList'
import { getShops } from '@/lib/data'
import { getTranslator } from '@/lib/i18n/t'
import { LOCALES, localizeHref, type Locale } from '@/lib/i18n/locales'
import { getOrigin } from '@/lib/site-url'

// 门店列表要跟着后台的发布状态走，不做构建期静态化。
export const dynamic = 'force-dynamic'

// canonical / og:url 必须是绝对地址：相对路径搜索引擎会直接忽略。主机取请求 host（见 src/lib/site-url）。

const PATHNAME = '/shops'

type Props = { params: Promise<{ locale: string }> }

function requireLocale(raw: string): Locale {
  if (!(raw in LOCALES)) notFound()
  return raw as Locale
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params
  const locale = requireLocale(raw)
  const t = getTranslator(locale)
  // 页面标题只到「店铺」为止：如果根布局配了 title.template，
  // 这里再拼一次站名会让它出现两遍（与公告列表页保持同一口径）。
  const title = t('shopsTitle')
  const description = t('shopsIntro')
  // 分享地址要带语言段（默认语言不带）：三种语言是三个 URL，不能撞成同一个。
  const path = localizeHref(PATHNAME, locale)
  const origin = await getOrigin()
  const canonical = new URL(path, origin).toString()

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, locale: LOCALES[locale].intl },
  }
}

export default async function ShopsPage({ params }: Props) {
  const { locale: raw } = await params
  const locale = requireLocale(raw)
  // getShops() 以 overrideAccess:false 走集合的访问控制（publishedOnly），
  // 草稿 / 未发布门店在这一步已经被过滤掉，页面不再判断 status。
  const shops = await getShops()

  return (
    <>
      {/* 内容语言说明：只有非默认语言的页面上才会出现（组件内部自行决定）。 */}
      <ContentLanguageNotice locale={locale} pathname={PATHNAME} />
      <ShopList shops={shops} />
    </>
  )
}
