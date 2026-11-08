'use client'

// 404 / 未匹配路由的整块内容：首页与列表页共用同一套品牌语言，这里也对齐。
//
// 设计意图（对照已实现的品牌系统）：
// - 大号 404 用 `text-brand` 而非 `text-faint`——站内任何处都找不到这支配色，
//   404 是全站唯一把它当「主视觉」用的场景，既延续「红是识别色」的认知，
//   又比纯灰更有记忆点（参考项目正是这么处理的）。
// - 下方给真实的「找回」出口：返回首页（主按钮）+ 浏览卡牌（次要链接），
//   再补一排主要栏目快捷入口（卡牌 / 公告 / 店铺 / 留言），让用户不管从哪个
//   旧链接进来都能原地落地，而不是停在死胡同。
// - 容器用 `surface` 卡片 + 软阴影承载，与卡牌列表的底板语言一致；
//   移动端单列、≥sm 双列回流快捷入口。
//
// 唯一的渲染入口是 `(frontend)/[locale]/not-found.tsx`：`[locale]/[...rest]`
// 这个 catch-all 把未匹配路径 notFound() 到那里，段内页面自己的 notFound()
// 也落到那里——两种来路共用同一个边界，因此全站 404 只有这一套视觉。
import Link from 'next/link'

import { localizeHref } from '@/lib/i18n/locales'
import { useLocale, useT } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/messages'

/** 快捷入口：路径 + 文案键。顺序照主导航，与页脚「站内链接」同源。 */
const QUICK_LINKS: { path: string; key: MessageKey }[] = [
  { path: '/cards', key: 'navCards' },
  { path: '/announcements', key: 'navAnnouncements' },
  { path: '/shops', key: 'navShops' },
  { path: '/message', key: 'navContact' },
]

export function NotFoundView() {
  const locale = useLocale()
  const t = useT()

  return (
    <div className="flex justify-center py-16 sm:py-24">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface px-6 py-12 text-center shadow-sm sm:px-10">
        {/* 大号 404：站内唯一把品牌红当主视觉用的场景。 */}
        <p
          className="select-none text-[clamp(4rem,16vw,7rem)] font-black leading-none tracking-tight text-brand"
          aria-hidden="true"
        >
          404
        </p>
        <h1 className="mt-4 text-xl font-bold text-fg sm:text-2xl">{t('notFoundHeading')}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
          {t('notFoundHint')}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link
            href={localizeHref('/', locale)}
            className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-on-accent transition hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
          >
            {t('backHome')}
          </Link>
          <Link
            href={localizeHref('/cards', locale)}
            className="inline-flex h-10 items-center rounded-full border border-border-strong px-5 text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
          >
            {t('browseCards')}
          </Link>
        </div>

        <nav aria-label={t('notFoundLinksLabel')} className="mt-10">
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">
            {t('notFoundLinksLabel')}
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            {QUICK_LINKS.map((link) => (
              <li key={link.path}>
                <Link
                  href={localizeHref(link.path, locale)}
                  className="inline-flex h-9 items-center rounded-lg px-2 text-body underline-offset-4 transition-colors duration-150 hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
                >
                  {t(link.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
