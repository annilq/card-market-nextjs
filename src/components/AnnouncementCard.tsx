import Link from 'next/link'

import type { Locale } from '@/lib/i18n/locales'
import { localizeHref } from '@/lib/i18n/locales'
import { formatDate, getTranslator } from '@/lib/i18n/t'
import type { AnnouncementView } from '@/lib/types'

export type AnnouncementCardProps = Readonly<{
  announcement: AnnouncementView
  locale: Locale
}>

/** 公告清单项：归档页与详情页底部的续读入口共用同一种可扫读结构。 */
export function AnnouncementCard({ announcement, locale }: AnnouncementCardProps) {
  const t = getTranslator(locale)

  return (
    <Link
      href={localizeHref(`/announcements/${announcement.id}`, locale)}
      className="group flex min-h-14 items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-muted"
    >
      <span
        aria-hidden="true"
        className={`h-5 w-0.5 shrink-0 rounded-full transition-colors duration-150 ${
          announcement.isPinned ? 'bg-pinned' : 'bg-transparent group-hover:bg-fg'
        }`}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          {announcement.isPinned && (
            <span className="shrink-0 rounded bg-pinned-bg px-1.5 py-0.5 text-[11px] font-normal text-pinned">
              {t('pinned')}
            </span>
          )}
          <span className="min-w-0 break-words font-medium text-fg">{announcement.title}</span>
        </span>
        {announcement.publishedAt && (
          <time
            dateTime={announcement.publishedAt}
            className="mt-1 block text-xs font-normal tabular-nums text-faint"
          >
            {formatDate(announcement.publishedAt, locale)}
          </time>
        )}
      </span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transform-none"
        aria-hidden="true"
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
    </Link>
  )
}
