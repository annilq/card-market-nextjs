import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AnnouncementCard } from '@/components/AnnouncementCard'
import { getAnnouncements } from '@/lib/data'
import { LOCALES, localizeHref } from '@/lib/i18n/locales'
import type { Locale } from '@/lib/i18n/locales'
import { getTranslator } from '@/lib/i18n/t'
import { pageWindow } from '@/lib/pagination'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3100'

type Props = {
  params: Promise<{ locale: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function requireLocale(raw: string): Locale {
  if (!(raw in LOCALES)) notFound()
  return raw as Locale
}

function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  const page = Number(value)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

function announcementsHref(locale: Locale, page = 1): string {
  const path = localizeHref('/announcements', locale)
  return page > 1 ? `${path}?page=${page}` : path
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale: raw } = await params
  const locale = requireLocale(raw)
  const t = getTranslator(locale)
  const query = (await searchParams) ?? {}
  const page = parsePage(query.page)
  const canonical = new URL(announcementsHref(locale, page), SITE_URL).toString()
  const title = t('announcementsTitle')
  const description = LOCALES[locale].description

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
  }
}

export default async function AnnouncementsPage({ params, searchParams }: Props) {
  const { locale: raw } = await params
  const locale = requireLocale(raw)
  const t = getTranslator(locale)
  const query = (await searchParams) ?? {}
  const page = parsePage(query.page)
  const result = await getAnnouncements({ limit: PAGE_SIZE, page })

  // API 已按发布时间取回当前页；这里再次稳定分组，确保归档页始终先展示置顶项。
  const announcements = [...result.items].sort(
    (left, right) => Number(right.isPinned) - Number(left.isPinned),
  )

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('announcementsTitle')}</h1>

      {announcements.length === 0 ? (
        // 空状态给下一步，而不是一行灰字：这个站的主任务是找卡，
        // 公告没有内容时把人送回卡牌列表比让他停在一句「暂无公告」前面有用。
        <div className="mt-8 rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-faint">{t('noAnnouncements')}</p>
          <Link
            href={localizeHref('/cards', locale)}
            className="mt-4 inline-flex min-h-9 items-center rounded-lg border border-border-strong px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
          >
            {t('browseCards')}
          </Link>
        </div>
      ) : (
        // 归档页：单一容器 + 发丝分隔线（与首页的三条摘要刻意不同——那边是
        // 「三条摘要读成一个对象」，这边是「一份可扫的清单」）。
        // 未设发布时间的不再渲染「—」：一排破折号比没有日期更吵。
        <ul className="mt-5 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {announcements.map((announcement) => (
            <li key={announcement.id}>
              <h2 className="font-normal">
                <AnnouncementCard announcement={announcement} locale={locale} />
              </h2>
            </li>
          ))}
        </ul>
      )}

      {result.totalPages > 1 && (
        <nav
          className="mt-8 flex flex-wrap items-center justify-center gap-1"
          aria-label={t('paginationAria')}
        >
          {page > 1 ? (
            <Link
              href={announcementsHref(locale, page - 1)}
              className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
            >
              {t('prevPage')}
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex min-h-9 items-center px-3 text-sm text-faint opacity-60"
            >
              {t('prevPage')}
            </span>
          )}

          {pageWindow(page, result.totalPages).map((pageNumber, index) =>
            pageNumber == null ? (
              <span key={`ellipsis-${index}`} aria-hidden="true" className="px-1 text-faint">
                …
              </span>
            ) : (
              <Link
                key={pageNumber}
                href={announcementsHref(locale, pageNumber)}
                aria-label={t('pageAria', { n: pageNumber })}
                aria-current={pageNumber === page ? 'page' : undefined}
                className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted ${
                  pageNumber === page
                    ? 'bg-brand font-semibold text-on-accent'
                    : 'text-muted hover:bg-surface-2 hover:text-fg'
                }`}
              >
                {pageNumber}
              </Link>
            ),
          )}

          {page < result.totalPages ? (
            <Link
              href={announcementsHref(locale, page + 1)}
              className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
            >
              {t('nextPage')}
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex min-h-9 items-center px-3 text-sm text-faint opacity-60"
            >
              {t('nextPage')}
            </span>
          )}
        </nav>
      )}
    </div>
  )
}
