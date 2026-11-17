// 首页「高价买取」横条卡片（设计图：`-h-index` / 高价买取区）。
//
// 与网格卡片（`CatalogCard`）分开的一个组件，而不是给 `CardCard` 加参数：
// 两者版式差得太远——这里是白底卡片、方形图位、状态徽章排在编号前面；
// 网格那里是无底透明卡片、3:4 图位、徽章压在图角上。共用一套 props 只会
// 让每个分支都在猜「这次是哪种」。旧组件 `CardCard` 原样保留，回滚只需换回引用。
//
// 设计实测（1920 画板，内容列 1200）：
//   卡位 228×450，5 列 gap 16；白卡四周内缩 15，里面是一块 198×278（5:7）的
//   浅灰图框 #FAFAFA——图框自身再留 ~13px 内边距，商品图 contain 居中，
//   所以图框的灰底会露在商品四周（评级壳两侧约 22px、裸卡约 13px）。
//   图框下 13 文字；标题 18/26 两行截断；状态徽章高 24，排在编号前面；
//   编号 16 灰；价格 28 加粗右对齐、贴底。徽章底色由后台卡牌状态的 color 字段决定。

import Link from 'next/link'

import { CardImage } from '@/components/CardImage'
import { statusBadgeClass } from '@/lib/card-status'
import { formatYen } from '@/lib/format'
import { getTranslator } from '@/lib/i18n/t'
import { localizeHref, type Locale } from '@/lib/i18n/locales'
import type { CardView } from '@/lib/types'

export function HighValueCard({
  card,
  locale,
  onOpen,
}: {
  card: CardView
  locale: Locale
  /** 给了这个回调，普通左键点击就改成弹出卡牌弹窗而不是跳详情页。 */
  onOpen?: (card: CardView) => void
}) {
  const t = getTranslator(locale)
  const img = card.images[0]
  // 横条卡位只有 228px，缩略图足够；没有缩略图再退到 cardUrl / 原图。
  const src = img?.thumbUrl || img?.cardUrl || img?.url
  const status = card.cardStatusName?.trim()

  return (
    <Link
      href={localizeHref(`/cards/${card.id}`, locale)}
      prefetch
      onClick={(e) => {
        if (!onOpen) return
        // 修饰键与中键留给浏览器：那是在要求「开新标签 / 新窗口」，
        // 拦下来会把用户想开的新标签页变成一个弹窗。
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        onOpen(card)
      }}
      className="group flex h-full flex-col overflow-hidden rounded border border-transparent bg-surface p-4 shadow-[0_1px_2px_rgb(15_23_42_/_0.06)] transition-[box-shadow,border-color] duration-150 hover:border-border hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
    >
      {/* 图框：白卡内缩 15px 的浅灰块，尺寸本身就是 5:7；图框自己的 padding
          让商品四周留出灰边。透明背景的商品图直接透出灰底，不透明的商品图
          也会被 padding 隔开——两种素材都读成「商品摆在灰台面上」。 */}
      <div className="relative aspect-[5/7] w-full overflow-hidden bg-[#fafafa] p-3 dark:bg-surface-2">
        {src ? (
          <CardImage
            src={src}
            alt={img?.alt || card.name}
            imgClassName="object-contain transition-transform duration-200 ease-out group-hover:scale-[1.03] motion-reduce:transform-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-hint">
            {t('noImage')}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col pt-3">
        {/* 卡名独占两行：状态徽章从名字前面挪到编号前面，长卡名不再被挤压截断。 */}
        <div className="line-clamp-2 text-lg font-bold leading-[26px] text-fg">
          {card.name}
        </div>

        {(status || card.code) && (
          <div className="mt-1 flex min-w-0 items-center gap-2 text-base text-faint">
            {status && (
              <span
                className={`inline-flex h-6 shrink-0 items-center rounded-md px-2.5 text-sm font-semibold ${statusBadgeClass(card.cardStatusColor)}`}
              >
                {status}
              </span>
            )}
            {card.code && <span className="min-w-0 truncate tabular-nums">{card.code}</span>}
          </div>
        )}

        <div className="mt-auto pt-2 text-right text-xl font-bold leading-none tabular-nums text-price">
          {card.stopBuyback
            ? t('stopBuyback')
            : card.price != null
              ? t('priceTag', { price: formatYen(card.price) })
              : t('priceOnRequest')}
        </div>
      </div>
    </Link>
  )
}
