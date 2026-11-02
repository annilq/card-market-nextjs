// 详情页底部的「还能看什么」。
//
// 源码这一页没有这一节（它只有图集 + 信息卡）；移植时补上，是因为详情页的出口
// 只剩页脚太窄。关系用「同 IP」而不是「最新上架」：读到详情最后的人想看的是
// 同类卡，最新上架答的是另一个问题，而那个问题首页已经答过一次。
//
// 取数纪律：多取一条再剔掉自己（当前卡必然命中同一个筛选条件），
// 这样「同 IP 只有这张卡」时不会退化成一条空行。
import Link from 'next/link'

import { CardCard } from '@/components/CardCard'
import { getCards, getLatestCards } from '@/lib/data'
import { localizeHref, type Locale } from '@/lib/i18n/locales'
import { getTranslator } from '@/lib/i18n/t'
import type { CardView } from '@/lib/types'

/** lg 起是 4 列，8 张正好两行。 */
const ROW_SIZE = 8

/**
 * 同 IP 的其他卡至少两张才用这条关系：一张卡的「同类」读起来像取数失败，
 * 而两张正好是手机端（2 列）的一整行。不够就退回最新上架。
 */
const MIN_SAME_IP = 2

export async function RelatedCards({
  card,
  locale,
}: {
  card: CardView
  locale: Locale
}) {
  const t = getTranslator(locale)

  const sameIp = card.ipId
    ? (
        await getCards({ ipIds: [card.ipId], limit: ROW_SIZE + 1, sort: 'newest' })
      ).items.filter((item) => item.id !== card.id)
    : []
  const byIp = sameIp.length >= MIN_SAME_IP

  const items = byIp
    ? sameIp.slice(0, ROW_SIZE)
    : (await getLatestCards(ROW_SIZE + 1))
        .filter((item) => item.id !== card.id)
        .slice(0, ROW_SIZE)

  if (!items.length) return null

  // 标题：同 IP 时直接用 IP 名（它本身就是这一排的分类名，右侧「全部 →」指向
  // 该 IP 的筛选结果，两处一起说明「这是同类的其他卡」）。
  // 目录里没有「同 IP 的其他卡牌」这个键（src/lib/i18n 不在本次改动范围内），
  // 与其拿 latestCards 顶上写错，不如让分类名自己说话。
  const heading = byIp && card.ipName ? card.ipName : t('latestCards')
  const href =
    byIp && card.ipId
      ? localizeHref(`/cards?ip=${card.ipId}`, locale)
      : localizeHref('/cards', locale)

  return (
    <section className="mt-12 border-t border-border pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="min-w-0 truncate text-sm font-semibold text-muted">{heading}</h2>
        <Link
          href={href}
          className="inline-flex min-h-8 shrink-0 items-center text-sm text-muted transition-colors duration-150 hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
        >
          {t('viewAll')}
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <CardCard key={item.id} card={item} locale={locale} />
        ))}
      </div>
    </section>
  )
}
