'use client'

// 首页高价买取横条（从 TanStack Start 版移植）。单行横向滚动，不换行、无箭头。
//
// 三处细节是「横条」这个形态特有的，网格里不需要：
//
// 1. **右缘渐隐。** 横条默认裁在最后一张卡的中间，看起来像布局出错。
//    右缘一层 `mask-image` 渐隐告诉人「还能往右」，且不需要画箭头。
// 2. **吸附滚动。** 手机上用手指甩时，卡片停在卡位边界而不是任意偏移。
// 3. **卡位略宽。** 原来 144px（`w-36`）在 3:4 图位里只有 108px 高的图，
//    卡名与价格挤成两行小字；改成 160px 后价格不再截断。

import { useEffect, useRef } from 'react'
import Link from 'next/link'

import { CardCard } from '@/components/CardCard'
import { getTranslator } from '@/lib/i18n/t'
import type { Locale } from '@/lib/i18n/locales'
import { localizeHref } from '@/lib/i18n/locales'
import type { CardView } from '@/lib/types'
import { useReducedMotion } from '@/lib/use-reduced-motion'

/** 自动轮播间隔。 */
const AUTOPLAY_MS = 4500

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
  // 卡片没溢出视口就没有可轮播的余量：内容少时保持普通横滑，不自动滚。
  const canRotateRef = useRef(false)
  // 三种暂停原因分开记，tick 现场判断，避免计时器闭包读到旧状态。
  const hoverRef = useRef(false)
  const focusRef = useRef(false)
  const interactingRef = useRef(false)
  const reducedRef = useRef(reducedMotion)
  const enabledRef = useRef(items.length > 1) // <=1 张卡完全不轮播
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 渲染期同步，让「减少动态 / 卡片数」变化后下一次 tick 立即生效。
  reducedRef.current = reducedMotion
  enabledRef.current = items.length > 1

  // 量一次 scrollWidth / clientWidth，并随窗口尺寸与列表变化重算。
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measure = () => {
      canRotateRef.current = track.scrollWidth > track.clientWidth + 8
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [items])

  // 常驻 interval，每次 tick 都从 ref 现读开关，不会捕获过期的 canRotate。
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const tick = () => {
      if (!enabledRef.current || reducedRef.current || !canRotateRef.current) return
      if (hoverRef.current || focusRef.current || interactingRef.current) return
      const step = (track.firstElementChild?.getBoundingClientRect().width ?? 0) + 12 // 卡宽 + gap-3
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4
      if (atEnd) track.scrollTo({ left: 0, behavior: 'smooth' }) // 到尾循环回起点
      else track.scrollBy({ left: step, behavior: 'smooth' })
    }
    const timer = setInterval(tick, AUTOPLAY_MS)

    // 用户按下指针/触摸时暂停，松手后稍等再续播，免得和用户拖拽抢滚动。
    const pause = () => {
      interactingRef.current = true
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    }
    const resume = () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
      resumeTimerRef.current = setTimeout(() => {
        interactingRef.current = false
      }, 1200)
    }
    track.addEventListener('pointerdown', pause)
    track.addEventListener('touchstart', pause)
    // 手指/指针可能划出横条才松开，收尾挂在 window 上；cancel 一并兜住。
    window.addEventListener('pointerup', resume)
    window.addEventListener('pointercancel', resume)
    window.addEventListener('touchend', resume)
    window.addEventListener('touchcancel', resume)

    return () => {
      clearInterval(timer)
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
      track.removeEventListener('pointerdown', pause)
      track.removeEventListener('touchstart', pause)
      window.removeEventListener('pointerup', resume)
      window.removeEventListener('pointercancel', resume)
      window.removeEventListener('touchend', resume)
      window.removeEventListener('touchcancel', resume)
    }
  }, [])

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
      {/* 可聚焦的滚动区域：键盘用户需先聚焦容器才能用方向键横向滚动。 */}
      <div
        ref={trackRef}
        role="region"
        aria-label={t('highValueBuys')}
        tabIndex={0}
        onMouseEnter={() => {
          // 只在可悬停的桌面设备暂停：触摸会合成 mouseenter，否则点一下就永久停播。
          if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            hoverRef.current = true
          }
        }}
        onMouseLeave={() => {
          if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            hoverRef.current = false
          }
        }}
        onFocus={() => { focusRef.current = true }}
        onBlur={(e) => {
          // 焦点在容器内换卡片时保持暂停，真正离开才恢复。
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
          focusRef.current = false
        }}
        className="strip-fade flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-xl pb-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong"
      >
        {items.map((c) => (
          // 卡位 224px：参考图的横条是 5 张 ≈227px 卡位铺满整行。
          <div key={c.id} className="w-44 shrink-0 snap-start sm:w-56">
            <CardCard card={c} locale={locale} compact />
          </div>
        ))}
      </div>
    </section>
  )
}
