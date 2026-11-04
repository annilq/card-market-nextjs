// 首页通知公告（从 TanStack Start 版移植：版式与注释原样保留，
// 只把 `useT()/useLocale()` 换成服务端 `getTranslator(locale)` + `locale` 道具）。
//
// 与公告列表页刻意不同——那边每条是独立卡片，因为那是可浏览的归档，
// 每条都是独立目的地。这里的差别本身就是信息：「三条摘要」 vs 「一份清单」。

import Link from 'next/link'

import { getTranslator, formatDate } from '@/lib/i18n/t'
import type { Locale } from '@/lib/i18n/locales'
import { localizeHref } from '@/lib/i18n/locales'
import type { AnnouncementView } from '@/lib/types'

/** 首页只露三条：实测通知面板 168px = 3 行 × 57px。父页可以按上限多取几条，这里截断。 */
const HOME_NOTICE_COUNT = 3

export function HomeNotices({
  items,
  locale,
}: {
  items: AnnouncementView[]
  locale: Locale
}) {
  const t = getTranslator(locale)

  return (
    <section>
      {/* 标题条：参考图是「整条品牌红 + 居中白字」，40px 高、横跨整个内容列。
          「全部」压在条的右端并用绝对定位，标题才能保持真正的居中。 */}
      <div className="relative flex h-10 items-center justify-center bg-brand px-4">
        <h2 className="text-xl font-bold text-white">{t('homeNotices')}</h2>
        <Link
          href={localizeHref('/announcements', locale)}
          className="absolute right-4 inline-flex items-center py-1 text-xs text-white transition-colors duration-150 hover:text-white hover:underline"
        >
          {t('viewAll')}
        </Link>
      </div>
      <ul className="divide-y divide-border border-b border-l border-r border-brand bg-surface px-4">
        {items.slice(0, HOME_NOTICE_COUNT).map((a) => (
          <li key={a.id}>
            <Link
              href={localizeHref(`/announcements/${a.id}`, locale)}
              // 44px 行高：整行是触控目标，不是只有文字。
              // 悬停时左侧 2px 指示条由透明转墨——指示条常驻、只换颜色，
              // 若让宽度从 0 长到 2px，整行文字会跟着左右跳。
              className="flex min-h-14 items-center gap-3 py-3"
            >
              {a.isPinned && (
                <span className="shrink-0 rounded bg-pinned-bg px-1.5 py-0.5 text-[11px] text-pinned">
                  {t('pinned')}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-lg text-fg">
                {a.title}
              </span>
              {/* 未设发布时间（发布即展示）的公告不占日期位——一排「—」比没有日期更吵。 */}
              {a.publishedAt && (
                <span className="w-24 shrink-0 whitespace-nowrap text-sm text-faint">
                  {formatDate(a.publishedAt, locale)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
