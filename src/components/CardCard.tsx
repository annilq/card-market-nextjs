'use client'

// 卡牌卡片：列表网格与首页横条共用。
//
// 从 TanStack 版本移植时只改了取值方式（Card → CardView，图片 URL 由 Payload 直出），
// 版式与「为什么这样排」的判断原样保留：
// - 网格里没有卡片底板，靠图片本身成块；横条里必须有白底板，否则读成一串散图。
// - 稀有度用字重不用颜色（客户可在后台自由增删档位，硬编码色阶会错位）。
// - 价格走 formatYen：TCG 卡没有「分」这个单位。
//
// `onOpen` 是唯一的客户端副作用：给了它，普通左键点击才改成「就地弹窗」，
// 因此整个组件必须是客户端组件。其余 props 与渲染结果一行未改——
// 列表页 / 详情页 / 首页横条的用法都不需要动。
import Link from 'next/link'

import { formatYen } from '@/lib/format'
import { getTranslator } from '@/lib/i18n/t'
import type { Locale } from '@/lib/i18n/locales'
import { localizeHref } from '@/lib/i18n/locales'
import type { CardView } from '@/lib/types'
import { CardImage } from './CardImage'

export function CardCard({
  card,
  locale,
  compact = false,
  onOpen,
  priority = false,
}: {
  card: CardView
  locale: Locale
  /** 首页高价买取横条：窄卡位只保留图片、卡名与价格。 */
  compact?: boolean
  /**
   * 给了这个回调，普通左键点击就改成「弹出卡牌弹窗」而不是跳详情页。
   * 元素本身仍是带 href 的 `<Link>`：中键 / Cmd / Ctrl / Shift 点击照旧开新标签，
   * 爬虫与读屏看到的也仍是一个真实链接——弹窗只是拦了普通左键。
   */
  onOpen?: (card: CardView) => void
  /** 首屏第一行的卡片设为 true，原生 fetchPriority=high 优化 LCP（图片走 S3 签名 302，无法用 next/image 优化器）。 */
  priority?: boolean
}) {
  const t = getTranslator(locale)
  const img = card.images[0]
  const src = compact ? img?.thumbUrl || img?.url : img?.cardUrl || img?.url
  const isVault = card.cardStatus === 'packaged'
  const isScarce = !!card.rarityName && ['SSR', 'UR'].includes(card.rarityName)

  return (
    <Link
      href={localizeHref(`/cards/${card.id}`, locale)}
      // 卡牌详情是全站最高频的跳转入口：进视口即预取整条路由
      // （配合 [locale]/loading.tsx 边界，见优化项 ②），点下去直接切到已就绪页面。
      prefetch
      onClick={(e) => {
        if (!onOpen) return
        // 修饰键与中键留给浏览器：那是在要求「开新标签 / 新窗口」，
        // 拦下来会把用户想开的新标签页变成一个弹窗。
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
          return
        }
        e.preventDefault()
        onOpen(card)
      }}
      className={`group relative block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted ${
        compact ? 'overflow-hidden rounded-xl border border-border bg-surface transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-md' : ''
      }`}
    >
      <div className={`relative aspect-[3/4] overflow-hidden rounded-lg bg-surface-2`}>
        {card.isHighValue && (
          // z-10：图片在 hover 时 scale 出 transform、自成一层，按 DOM 顺序会盖在
          // 位于它之前的徽章上；抬一层保证「高价买取」悬停时不被放大的图遮住。
          <span className="absolute left-1 top-1 z-10 rounded-xl bg-brand px-1.5 py-0.5 text-[11px] text-white">
            {t('highValue')}
          </span>
        )}
        {src ? (
          // 媒体走 S3 签名下载（/api/media/file/<x> 返回 302 到临时 S3 URL），
          // next/image 优化器无法优化「重定向」，会在服务端 400 失败，故这里用原生 <img>，
          // 让浏览器原生跟随 302。首屏行用 loading=eager + fetchPriority=high 优化 LCP。
          // 加载占位 + 淡入由 CardImage 统一处理。
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
        {isVault && (
          <span aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-1 bg-vault" />
        )}
        {isVault && (
          <span className="absolute left-2 top-2 z-10 rounded bg-surface px-1.5 py-0.5 text-[11px] font-medium text-vault shadow-sm">
            {t('statusPackaged')}
          </span>
        )}
      </div>

      <div className={compact ? 'p-2' : 'pt-2.5'}>
        <div className="line-clamp-2 text-sm font-medium leading-snug text-fg">{card.name}</div>
        {!compact && (
          <div className="truncate text-xs text-faint">
            {[card.ipName, card.seriesName].filter(Boolean).join(' · ')}
          </div>
        )}
        <div className="mt-2 flex items-baseline justify-end gap-2">
          <span className="text-[20px] font-bold tabular-nums text-price">
            {card.price != null ? t('priceTag', { price: formatYen(card.price) }) : t('priceOnRequest')}
          </span>
          {!compact && card.rarityName && (
            <span className={`text-xs text-faint ${isScarce ? 'font-semibold' : ''}`}>
              {card.rarityName}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
