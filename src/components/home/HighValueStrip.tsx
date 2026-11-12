'use client'

// 首页高价买取横条（从 TanStack Start 版移植）。单行横向滚动，不换行、不自动轮播。
//
// 四处细节是「横条」这个形态特有的，网格里不需要：
//
// 1. **右缘渐隐。** 横条默认裁在最后一张卡的中间，看起来像布局出错。
//    右缘一层 `mask-image` 渐隐告诉人「还能往右」；滚到末尾后渐隐撤掉，
//    否则最后一张卡会一直被裁掉一角。
// 2. **左右箭头。** 内容宽度超过容器时才出现，桌面用户不用去够滚动条；
//    到两端时对应一侧淡出。手机上仍可直接甩动。
// 3. **吸附滚动。** 手机上用手指甩时，卡片停在卡位边界而不是任意偏移。
// 4. **卡位略宽。** 原来 144px（`w-36`）在 3:4 图位里只有 108px 高的图，
//    卡名与价格挤成两行小字；改成 160px 后价格不再截断。

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { getTranslator } from '@/lib/i18n/t'
import { HighValueCard } from './HighValueCard'
import type { Locale } from '@/lib/i18n/locales'
import { localizeHref } from '@/lib/i18n/locales'
import type { CardView } from '@/lib/types'
import { useReducedMotion } from '@/lib/use-reduced-motion'

/** 卡片间距，与下方 `gap-4` 一致；翻页步长 = 卡宽 + 间距。 */
const CARD_GAP = 16

export function HighValueStrip({
  items,
  locale,
}: {
  items: CardView[]
  locale: Locale
}) {
  const t = getTranslator(locale)
  const reducedMotion = useReducedMotion()

  const trackRef = useRef<HTMLDivElement | null>(null)

  // 箭头只在内容溢出容器时出现；到两端时各自禁用。滚动时同步，
  // 拖拽 / 按钮翻页 / 窗口缩放都能拿到正确的端点状态。
  const [overflowing, setOverflowing] = useState(false)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  // 量一次 scrollWidth / clientWidth，并随窗口尺寸与列表变化重算。
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const sync = () => {
      setOverflowing(track.scrollWidth > track.clientWidth + 8)
      setAtStart(track.scrollLeft <= 4)
      setAtEnd(track.scrollLeft + track.clientWidth >= track.scrollWidth - 4)
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(track)
    track.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    return () => {
      ro.disconnect()
      track.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [items])

  // 点箭头切换一张卡：位移正好一个卡位，停下时落在吸附点上。
  const scrollByCard = (direction: -1 | 1) => {
    const track = trackRef.current
    if (!track) return
    const step = (track.firstElementChild?.getBoundingClientRect().width ?? 0) + CARD_GAP
    track.scrollBy({ left: direction * step, behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  return (
    <section>
      {/* 区块标题：参考图里这一块是居中的品牌红图形标题，因此标题居中、
           用品牌红而不是墨黑；「全部」压在右端（绝对定位）才能保住居中。
           图形标题 high_price.png 已随静态资源迁到 public/，与源站同一张图。 */}
      <div className="relative mb-4 flex items-center justify-center">
        <img
          src="/high_price.png"
          alt={t('highValueBuys')}
          width={205}
          height={86}
          className="h-10 w-auto md:h-20"
        />
        <Link
          href={localizeHref('/cards?hv=1', locale)}
          className="absolute right-0 inline-flex items-center py-1 text-xs text-muted transition-colors duration-150 hover:text-fg hover:underline"
        >
          {t('viewAll')}
        </Link>
      </div>
      {/* 箭头是滚动区的兄弟节点：滚动区带右缘 mask，箭头放里面会被一起渐隐。 */}
      <div className="relative">
        {/* 可聚焦的滚动区域：键盘用户需先聚焦容器才能用方向键横向滚动。 */}
        <div
          ref={trackRef}
          role="region"
          aria-label={t('highValueBuys')}
          tabIndex={0}
          className={`flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong ${atEnd ? '' : 'strip-fade'}`}
        >
          {items.map((c) => (
            // 卡位 227px：内容列 1200 − 4 × gap 16 = 1136，5 张正好铺满首屏
            //（设计图卡位 228，1px 取整差落在右缘渐隐里）。
            <div key={c.id} className="w-44 shrink-0 snap-start sm:w-[227px]">
              <HighValueCard card={c} locale={locale} />
            </div>
          ))}
        </div>

        {/* 只有内容真正溢出时才出现箭头；到两端时对应的一侧淡出。 */}
        {overflowing && (
          <>
            <button
              type="button"
              aria-label={t('stripPrev')}
              disabled={atStart}
              onClick={() => scrollByCard(-1)}
              className="absolute left-1 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-fg shadow-md transition-[opacity,background-color] duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong disabled:pointer-events-none disabled:opacity-0"
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-5 w-5">
                <path
                  d="M12.5 5 7.5 10l5 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              aria-label={t('stripNext')}
              disabled={atEnd}
              onClick={() => scrollByCard(1)}
              className="absolute right-1 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-fg shadow-md transition-[opacity,background-color] duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong disabled:pointer-events-none disabled:opacity-0"
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-5 w-5">
                <path
                  d="M7.5 5l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </>
        )}
      </div>
    </section>
  )
}
