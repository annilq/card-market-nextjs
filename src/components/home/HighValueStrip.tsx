'use client'

// 首页不减额买取横条。单行横向滚动，不自动轮播。
//
// 五处细节是「横条」这个形态特有的，网格里不需要：
//
// 1. **右缘渐隐。** 横条默认裁在最后一张卡的中间，看起来像布局出错。
//    右缘一层 `mask-image` 渐隐告诉人「还能往右」；滚到末尾后渐隐撤掉，
//    否则最后一张卡会一直被裁掉一角。
// 2. **左右箭头只在桌面出现。** 内容宽度超过容器时才渲染，到两端时对应一侧淡出。
//    手机不显示箭头，横向甩动就是唯一的切换方式。
// 3. **吸附滚动。** 手机上用手指甩时，卡片停在卡位边界而不是任意偏移。
// 4. **卡位略宽。** 原来 144px（`w-36`）在 3:4 图位里只有 108px 高的图，
//    卡名与价格挤成两行小字；改成 160px 后价格不再截断。
// 5. **桌面鼠标拖动。** 原生横向滚动只认滚轮和触控板，按住拖动由指针事件补上；
//    松手吸附到最近卡位，拖动末尾补发的 click 会被吞掉，不会误开卡片。

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import Link from 'next/link'

import { CardModal } from '@/components/catalog/CardModal'
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

  // 弹窗状态放在横条这一层：整条横条只挂一个弹窗，点哪张就换成哪张。
  const [open, setOpen] = useState<CardView | null>(null)

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

  // 桌面鼠标拖动。原生横向滚动只认滚轮和触控板，按住拖动要自己接；
  // 触摸与手写笔继续走浏览器原生的甩动，因此这里只认 mouse。
  const dragRef = useRef<{
    startX: number
    startLeft: number
    moved: boolean
    captured: boolean
  } | null>(null)
  const draggedAtRef = useRef(0)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const track = trackRef.current
    if (!track || track.scrollWidth <= track.clientWidth + 8) return
    dragRef.current = { startX: e.clientX, startLeft: track.scrollLeft, moved: false, captured: false }
    setDragging(true)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const track = trackRef.current
    if (!drag || !track) return
    const dx = e.clientX - drag.startX
    // 4px 死区：手抖不算拖动，否则一次普通点击会被吞掉。
    if (!drag.moved && Math.abs(dx) > 4) {
      drag.moved = true
      // 确认是拖动之后才捕获指针。在 pointerdown 就捕获会让 pointerup 落在
      // 滚动区上，随之补发的 click 也落在滚动区，普通点击卡片就再也开不了弹窗。
      track.setPointerCapture(e.pointerId)
      drag.captured = true
    }
    if (!drag.moved) return
    e.preventDefault()
    track.scrollLeft = drag.startLeft - dx
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const track = trackRef.current
    if (!drag || !track) return
    dragRef.current = null
    setDragging(false)
    if (drag.captured && track.hasPointerCapture(e.pointerId)) {
      track.releasePointerCapture(e.pointerId)
    }
    if (!drag.moved) return
    draggedAtRef.current = Date.now()
    // 松手后落到最近的卡位，和箭头翻页、触摸甩动的停点一致。
    const step = (track.firstElementChild?.getBoundingClientRect().width ?? 0) + CARD_GAP
    if (step > 0) {
      track.scrollTo({
        left: Math.round(track.scrollLeft / step) * step,
        behavior: reducedMotion ? 'auto' : 'smooth',
      })
    }
  }

  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    // 拖动松手时浏览器仍会在落点补一次 click，它不该被读成「点了这张卡」。
    if (Date.now() - draggedAtRef.current < 250) {
      e.preventDefault()
      e.stopPropagation()
    }
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
          href={localizeHref('/cards?nd=1', locale)}
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
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          onClickCapture={onClickCapture}
          onDragStart={(e) => e.preventDefault()}
          // 拖动时关掉吸附，否则每次改 scrollLeft 都会被拉回卡位；松手时再吸附。
          style={dragging ? { scrollSnapType: 'none' } : undefined}
          // 滚动条隐藏但滚动保留：右缘渐隐与箭头已经承担「还能往右」的提示，
          // 露出系统滚动条会在卡片下方多出一条横线。
          className={`flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong ${atEnd ? '' : 'strip-fade'} ${dragging ? 'cursor-grabbing select-none' : 'sm:cursor-grab'}`}
        >
          {items.map((c) => (
            // 卡位 227px：内容列 1200 − 4 × gap 16 = 1136，5 张正好铺满首屏
            //（设计图卡位 228，1px 取整差落在右缘渐隐里）。
            <div key={c.id} className="w-44 shrink-0 snap-start sm:w-[227px]">
              <HighValueCard card={c} locale={locale} onOpen={setOpen} />
            </div>
          ))}
        </div>

        {/* 只有内容真正溢出时才出现箭头，且只在桌面显示；手机用横向甩动切换。 */}
        {overflowing && (
          <>
            <button
              type="button"
              aria-label={t('stripPrev')}
              disabled={atStart}
              onClick={() => scrollByCard(-1)}
              className="absolute left-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-fg shadow-md transition-[opacity,background-color] duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong disabled:pointer-events-none disabled:opacity-0 sm:flex"
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
              className="absolute right-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-fg shadow-md transition-[opacity,background-color] duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong disabled:pointer-events-none disabled:opacity-0 sm:flex"
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

      {open && <CardModal card={open} locale={locale} onClose={() => setOpen(null)} />}
    </section>
  )
}
