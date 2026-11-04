import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AnnouncementCard } from '@/components/AnnouncementCard'
import { ContentLanguageNotice } from '@/components/ContentLanguageNotice'
import { getAnnouncement, getAnnouncements } from '@/lib/data'
import { LOCALES, localizeHref } from '@/lib/i18n/locales'
import type { Locale } from '@/lib/i18n/locales'
import { formatDate, getTranslator } from '@/lib/i18n/t'
import { getOrigin } from '@/lib/site-url'

export const dynamic = 'force-dynamic'


type Props = {
  params: Promise<{ locale: string; id: string }>
}

function requireLocale(raw: string): Locale {
  if (!(raw in LOCALES)) notFound()
  return raw as Locale
}

/** 富文本转纯文本摘要，供 meta description 使用。 */
function plainText(html: string | null | undefined, max = 140): string {
  if (!html) return ''
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, id } = await params
  const locale = requireLocale(raw)
  const t = getTranslator(locale)
  const numericId = Number(id)
  const item = await getAnnouncement(numericId)
  const origin = await getOrigin()
  const canonical = new URL(
    localizeHref(`/announcements/${encodeURIComponent(id)}`, locale),
    origin,
  ).toString()

  if (!item) {
    const title = t('announcementNotFound')
    return {
      title,
      description: title,
      alternates: { canonical },
      robots: { index: false, follow: false },
    }
  }

  const description = plainText(item.bodyHtml) || LOCALES[locale].description
  return {
    title: item.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title: item.title,
      description,
      url: canonical,
      publishedTime: item.publishedAt ?? undefined,
    },
  }
}

export default async function AnnouncementDetailPage({ params }: Props) {
  const { locale: raw, id } = await params
  const locale = requireLocale(raw)
  const t = getTranslator(locale)
  const numericId = Number(id)
  // 同时取回一小段公告列表：正文底部要给出「其他公告」，让读到最后的人有下一步。
  // 列表本身很小（客户一个人运营），多这一个请求换来一条真实的续读路径。
  const [item, all] = await Promise.all([
    getAnnouncement(numericId),
    getAnnouncements({ limit: 3 }),
  ])

  if (!item) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-base font-normal text-muted">{t('announcementNotFound')}</h1>
        <Link
          href={localizeHref('/announcements', locale)}
          className="mt-3 inline-flex min-h-9 items-center text-fg underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
        >
          {t('backToAnnouncements')}
        </Link>
      </div>
    )
  }

  const others = all.items
    .filter((announcement) => announcement.id !== item.id)
    .slice(0, 2)

  return (
    // 正文铺满整条内容列：参考图实测正文 357→1559（1200px），不是窄栏。
    <article>
      <Link
        href={localizeHref('/announcements', locale)}
        className="inline-flex min-h-8 items-center py-1 text-sm text-muted transition-colors duration-150 hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
      >
        {t('backToAnnouncementsArrow')}
      </Link>

      <ContentLanguageNotice locale={locale} />

      {/* 标题 ~28px：参考图里公告标题实测约 29px，比 24px 更接近。
          置顶徽章前置到标题同一行，日期另起一行右对齐——这是参考图的排版。 */}
      <h1 className="mt-2 flex flex-wrap items-center gap-2 break-words text-[28px] font-bold leading-snug">
        {item.isPinned && (
          <span className="rounded bg-pinned-bg px-1.5 py-0.5 text-[11px] font-medium text-pinned">
            {t('pinned')}
          </span>
        )}
        {item.title}
      </h1>
      {/* 未设发布时间就不渲染日期行：一排「—」比没有日期更吵。 */}
      {item.publishedAt && (
        <div className="mt-2 flex justify-end text-xs tabular-nums text-faint">
          <time dateTime={item.publishedAt}>{formatDate(item.publishedAt, locale)}</time>
        </div>
      )}
      {item.bodyHtml && (
        // 富文本由管理员在后台维护；数据层已把 Payload Lexical 转为受控 HTML。
        // 首段由 `.prose > p:first-of-type` 提到 18px，读者真正开始读的地方。
        <div
          className="prose mt-6 text-body [&_a]:text-link [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted [&_code]:rounded [&_code]:bg-muted/10 [&_code]:px-1 [&_em]:italic [&_h1]:mb-2 [&_h1]:mt-6 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-fg [&_h2]:mb-1.5 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-fg [&_h3]:font-semibold [&_h3]:text-fg [&_hr]:border-border [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:leading-relaxed [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: item.bodyHtml }}
        />
      )}

      {/* 其他公告：读到最后的人需要下一步，而不是只剩页脚。 */}
      {others.length > 0 && (
        <section className="mt-12 border-t border-border pt-5">
          <h2 className="text-sm font-semibold text-muted">{t('otherAnnouncements')}</h2>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {others.map((announcement) => (
              <li key={announcement.id}>
                <h3 className="font-normal">
                  <AnnouncementCard announcement={announcement} locale={locale} />
                </h3>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
