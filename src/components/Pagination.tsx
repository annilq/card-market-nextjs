// 页码分页：‹ 1 2 … 20 ›。
//
// 与 TanStack 版本唯一的差别是「跳转」的实现：那里是回调，这里是 `next/link`。
// 原因就是 PRODUCT.md 的「URL 是状态」——翻页必须是可分享、可回访、可被爬虫走的链接，
// 组件因此只负责把页码拼成 href，不认识路由，也不持有状态。
// 组件保持服务端可用（不用 hooks、不读浏览器），只有链接本身是客户端导航。
import Link from 'next/link'

import { getTranslator } from '@/lib/i18n/t'
import { localizeHref, type Locale } from '@/lib/i18n/locales'
import { pageWindow } from '@/lib/pagination'

export function Pagination({
  page,
  totalPages,
  locale,
  buildHref,
}: {
  page: number
  totalPages: number
  locale: Locale
  /**
   * 由调用方拼 href：它才知道当前有哪些筛选参数要带过去。
   * 不给时退回「只带页码」的裸列表地址（首页等无筛选的场景够用）。
   */
  buildHref?: (page: number) => string
}) {
  const t = getTranslator(locale)
  if (totalPages <= 1) return null

  const href = buildHref ?? ((n: number) => localizeHref(n > 1 ? `/cards?page=${n}` : '/cards', locale))

  const slots = pageWindow(page, totalPages)
  // 窄屏（<390）放不下「9 个 36px 控件 + 间距」共 372px。两种处理方式：
  // 换行（325 时两行）或收缩。选收缩：分页是一条整体语义，换行会读成两组页码。
  // 最窄 28px（320 时），仍高于 WCAG 2.5.8 的 24px 最小点击尺寸；360 以上回到 32/36px。
  // 参考图：当前页是一颗品牌红方块，其余页码没有边框，只有文字。
  const arrow =
    'inline-flex h-9 min-w-7 min-[360px]:min-w-8 sm:min-w-9 items-center justify-center rounded px-1.5 min-[360px]:px-2 sm:px-3 text-sm text-muted hover:bg-surface-2 hover:text-fg transition'
  const pageBtn =
    'inline-flex h-9 min-w-7 min-[360px]:min-w-8 sm:min-w-9 items-center justify-center rounded px-1.5 min-[360px]:px-2 sm:px-3 text-sm transition'

  return (
    <nav aria-label={t('paginationAria')} className="mt-8 flex justify-center">
      <div className="flex items-center justify-center gap-1 max-w-full">
        {page > 1 ? (
          <Link href={href(page - 1)} aria-label={t('prevPage')} className={arrow}>
            ‹
          </Link>
        ) : (
          // 到头的箭头不出链接：一颗指不到任何地方的链接比灰掉的按钮更容易误导。
          <span aria-hidden="true" className={`${arrow} opacity-40`}>
            ‹
          </span>
        )}

        {slots.map((n, i) =>
          n === null ? (
            <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-sm text-faint">
              …
            </span>
          ) : (
            <Link
              key={n}
              href={href(n)}
              aria-label={t('pageAria', { n })}
              aria-current={n === page ? 'page' : undefined}
              className={
                n === page
                  ? `${pageBtn} bg-brand font-semibold text-white`
                  : `${pageBtn} text-fg hover:bg-surface-2`
              }
            >
              {n}
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Link href={href(page + 1)} aria-label={t('nextPage')} className={arrow}>
            ›
          </Link>
        ) : (
          <span aria-hidden="true" className={`${arrow} opacity-40`}>
            ›
          </span>
        )}
      </div>
    </nav>
  )
}
