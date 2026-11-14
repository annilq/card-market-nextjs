'use client'

// 筛选结果网格卡片（设计图：`-h-index` / 分类筛选下方的卡牌网格）。
//
// 与首页横条卡（`HighValueCard`）分成两个组件：网格里没有卡片底板，图直接
// 铺在页面底色上；徽章压在图角，标题/编号/价格构成三行文字。旧组件
// `CardCard` 保持不动，回滚只需把调用点换回去。
//
// 设计实测（1920 画板，内容列 1200）：
//   8 列 gap 8；图位 143×200（5:7，object-cover）；图下 12 文字；
//   标题两行、编号 14 灰、价格 24 加粗右对齐；行距 24。
//   标题设计是 16/20，这里按需求放大到 18/22 加粗。稀有度不展示
//   （列表里没有这个字段的位置）。
//   「高价买取」红标 80×30，压在图左上角（内缩 4），右下圆角。
//
// 客户端组件的原因与旧 CardCard 相同：给了 `onOpen` 时普通左键改成就地弹窗，
// 但元素仍是带 href 的 `<Link>`，中键 / Cmd / Ctrl / Shift 点击照旧开新标签。

import Link from 'next/link'

import { CardImage } from '@/components/CardImage'
import { formatYen } from '@/lib/format'
import { getTranslator } from '@/lib/i18n/t'
import { localizeHref, type Locale } from '@/lib/i18n/locales'
import type { CardView } from '@/lib/types'

export function CatalogCard({
  card,
  locale,
  onOpen,
  priority = false,
}: {
  card: CardView
  locale: Locale
  /** 给了这个回调，普通左键点击就改成弹出卡牌弹窗而不是跳详情页。 */
  onOpen?: (card: CardView) => void
  /** 首屏卡片的图片设 fetchPriority=high，优化 LCP（媒体走 S3 302，不能用 next/image）。 */
  priority?: boolean
}) {
  const t = getTranslator(locale)
  const img = card.images[0]
  // 网格卡位 143–175px：cardUrl 与缩略图都够用，优先更清晰的 cardUrl。
  const src = img?.cardUrl || img?.thumbUrl || img?.url
  // 设计图只给了「高价买取」；「不减额买取」沿用同一颗标（与旧卡片的信息层级一致）。
  const badge = card.isHighValue ? t('highValue') : card.isNoDeduction ? t('noDeduction') : null

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
      className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
    >
      <div className="bg-surface p-1">
        {/* 图位锁定设计稿的 5:7：固定 200px 高在窄屏会把竖版卡面上下裁掉 15%–25%。 */}
        <div className="relative aspect-[5/7] w-full overflow-hidden">
          {src ? (
            <CardImage
              src={src}
              alt={img?.alt || card.name}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              imgClassName="object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03] motion-reduce:transform-none"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-hint">
              {t('noImage')}
            </div>
          )}
          {badge && (
            // 压在图左上角：图位的圆角会裁掉徽章左上角，因此只给右下圆角。
            <span className="absolute top-0 left-0 rounded-full bg-brand px-2 h-7.5 font-semibold flex items-center justify-center text-white">
              {badge}
            </span>
          )}
        </div>
      </div>

      <div className="pt-2">
        <div className="line-clamp-2 font-bold text-fg">
          {card.name}
        </div>
        {/* 编号行固定占一行：缺编号的卡不会把价格往上顶，整行价格保持同一条线。 */}
        <div className="mt-1 truncate text-sm text-faint leading-none">{card.code||"无"}</div>
        <div className="mt-2 text-right text-xl font-bold leading-none tabular-nums text-price">
          {card.price != null
            ? t('priceTag', { price: formatYen(card.price) })
            : t('priceOnRequest')}
        </div>
      </div>
    </Link>
  )
}
