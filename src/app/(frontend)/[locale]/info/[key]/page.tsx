// 审核用信息页：/info/operation | /info/personal-info | /info/terms | /info/data-usage
//
// 语言段由上级 `[locale]` 继承（`/ja/info/terms`，zh 不带前缀）。
// 内容由 Payload 的 info-pages 驱动，页面结构（标题层级、间距）由前端固定。
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { ContentLanguageNotice } from '@/components/ContentLanguageNotice'
import { getInfoPage } from '@/lib/data'
import { INFO_PAGE_LABEL_KEY, resolveInfoPageKey } from '@/lib/info-pages'
import { LOCALES, localizeHref, type Locale } from '@/lib/i18n/locales'
import { getTranslator } from '@/lib/i18n/t'
import type { InfoPageView } from '@/lib/types'

// 后台内容随时可改，且这条路径还要能被审计抓取：不做静态化。
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ locale: string; key: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

/** 富文本转纯文本用于 description：只做标签剥离，不追求精确的实体解码。 */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const DESCRIPTION_LENGTH = 160

// generateMetadata 与页面组件各要一次同样的内容：用 React cache 在同一次请求内合并成一次查询。
const loadPage = cache(async (key: string): Promise<InfoPageView | null> => {
  try {
    return await getInfoPage(key)
  } catch (error) {
    // 后台不可达时按「未发布」渲染，而不是整页 500：这些入口是审计要求存在的页面。
    console.error('[info] load failed', key, error)
    return null
  }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, key: rawKey } = await params
  if (!(rawLocale in LOCALES)) return {}
  const locale = rawLocale as Locale
  // 未登记的标识走页面的 notFound，这里同样不该给出可索引的 metadata。
  const infoKey = resolveInfoPageKey(rawKey)
  if (!infoKey) return {}

  const t = getTranslator(locale)
  const page = await loadPage(infoKey)
  // 页面可能尚未发布，此时标题仍用界面文案，描述留空由布局兜底。
  const title = page?.title || t(INFO_PAGE_LABEL_KEY[infoKey])
  const description = plainText(page?.bodyHtml ?? '')
  return {
    title,
    description: description ? description.slice(0, DESCRIPTION_LENGTH) : undefined,
  }
}

export default async function InfoPage({ params }: Props) {
  const { locale: rawLocale, key: rawKey } = await params
  if (!(rawLocale in LOCALES)) notFound()
  const locale = rawLocale as Locale

  // 未登记的标识直接 404，避免把任意路径段当成信息页渲染。
  const infoKey = resolveInfoPageKey(rawKey)
  if (!infoKey) notFound()

  const page = await loadPage(infoKey)
  const t = getTranslator(locale)
  // 后台未发布时仍给出可读标题（来自界面文案），并提示内容尚未发布，
  // 而不是把整个页面变成 404——页脚入口必须始终能落到一个有效页面（审计要求）。
  const title = page?.title || t(INFO_PAGE_LABEL_KEY[infoKey])

  return (
    // 与公告详情一致：正文铺满整条内容列（参考图实测 1200px），不设窄栏。
    <article>
      <div className="text-xs text-faint">{t('infoNavTitle')}</div>
      {/* 28px：参考图里信息页标题实测约 30px，与公告标题同一档。 */}
      <h1 className="mt-1 break-words text-[28px] font-bold leading-snug">{title}</h1>

      <ContentLanguageNotice locale={locale} pathname={`/info/${infoKey}`} />

      {page?.bodyHtml ? (
        // 富文本由管理员在后台维护（受信任来源），已在数据层经 renderRichText 转为 HTML，
        // 与公告详情一致。h2 从 16px 提到 18px：审核类长文靠小标题分段，
        // 16px 与正文同尺寸时分不出层级。
        <div
          className="prose mt-6 text-body [&_a]:text-link [&_a]:underline [&_a]:underline-offset-2 [&_h1]:text-fg [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mt-7 [&_h1]:mb-2 [&_h2]:text-fg [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-7 [&_h2]:mb-2 [&_h3]:text-fg [&_h3]:font-semibold [&_h3]:mt-5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_em]:italic [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted [&_code]:rounded [&_code]:bg-muted/10 [&_code]:px-1 [&_hr]:border-border [&_p]:leading-relaxed"
          dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
        />
      ) : (
        <p className="mt-4 text-sm text-muted">{t('infoPageNotFound')}</p>
      )}

      <div className="mt-10 border-t border-border pt-5">
        <Link
          href={localizeHref('/', locale)}
          className="inline-flex min-h-6 items-center text-sm text-muted transition-colors duration-150 hover:text-fg hover:underline"
        >
          {t('backHomeArrow')}
        </Link>
      </div>
    </article>
  )
}
