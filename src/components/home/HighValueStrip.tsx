'use client'

// 首页不减额买取横条。单行横向滚动，默认持续自动滚动。
//
// 自动滚动是「连续位移」，不是按卡翻页：每帧把 scrollLeft 推进不到 1px，
// 整条横条像传送带一样匀速左移。为了首尾无缝，卡片渲染两遍；
// 滚动满一组卡片的宽度后减去这个宽度，画面正好落在完全相同的第二组上，
// 看不出接缝。悬停 / 触摸 / 聚焦 / 拖动 / 弹窗打开时暂停，离开后继续。
//
// 六处细节是「横条」这个形态特有的，网格里不需要：
//
// 1. **右缘渐隐。** 横条默认裁在最后一张卡的中间，看起来像布局出错。
//    右缘一层 `mask-image` 渐隐告诉人「还能往右」；内容不溢出时不加。
// 2. **左右箭头只在桌面出现。** 内容宽度超过容器时才渲染；无限循环下
//    没有「到头」状态，翻页越过边界时瞬间接回另一侧。
// 3. **只在暂停时吸附。** 自动滚动期间必须关掉 scroll-snap，否则每帧写
//    scrollLeft 都会被拉回卡位；手一停下（悬停 / 触摸 / 聚焦）再恢复吸附。
// 4. **卡位略宽。** 原来 144px（`w-36`）在 3:4 图位里只有 108px 高的图，
//    卡名与价格挤成两行小字；改成 160px 后价格不再截断。
// 5. **桌面鼠标拖动。** 原生横向滚动只认滚轮和触控板，按住拖动由指针事件补上；
//    松手吸附到最近卡位，拖动末尾补发的 click 会被吞掉，不会误开卡片。
// 6. **减少动态效果时退回手动。** 不渲染重复卡片、不启动自动滚动，
//    箭头与拖动照常可用。

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
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

/** 持续滚动速度（px/s）。227px 的卡约 5.7 秒过一张，慢到能看清卡名与价格。 */
const AUTO_SCROLL_SPEED = 40

export function HighValueStrip({
  items,
  locale,
}: {
  items: CardView[]
  locale: Locale
}) {
  const t = getTranslator(locale)
  const reducedMotion = useReducedMotion()

  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)

  // 累积的浮点滚动位置。scrollLeft 会被取整，逐帧 +0.67px 会被舍入吃掉，
  // 所以位置自己累加，只在写 scrollLeft 时交给浏览器取整。
  const posRef = useRef(0)
  // 一组卡片的宽度（含组内 gap）。滚动到这里就减去它，接回第二组。
  const loopWidthRef = useRef(0)
  // 暂停状态放 ref：rAF 每帧都要读，走 state 会不断重启循环。
  const pausedRef = useRef(false)
  const resumeTimerRef = useRef<number | null>(null)

  // 箭头与右缘渐隐只在内容溢出容器时出现。
  const [overflowing, setOverflowing] = useState(false)
  // 是否需要渲染第二组续接卡。首帧不渲染，量完容器再决定：
  // 卡片放得下时没有滚动，也就没有必要把同一张卡排两遍。
  const [duplicated, setDuplicated] = useState(false)
  // 只用于决定 scroll-snap 开关：自动滚动时关，暂停时开。
  const [paused, setPaused] = useState(false)
  // 不循环时（减少动态效果 / 内容刚放得下）箭头到两端要禁用，
  // 否则点下去没反应，看起来像坏了。循环时两端永远可点。
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  // 弹窗状态放在横条这一层：整条横条只挂一个弹窗，点哪张就换成哪张。
  const [open, setOpen] = useState<CardView | null>(null)

  const pauseAuto = () => {
    if (resumeTimerRef.current != null) {
      window.clearTimeout(resumeTimerRef.current)
      resumeTimerRef.current = null
    }
    pausedRef.current = true
    setPaused(true)
  }

  // 触摸甩动有惯性，恢复得太快会和剩余的滚动打架，因此手机多等一会儿；
  // 鼠标移开则立刻恢复。
  const scheduleResume = (delay: number) => {
    if (resumeTimerRef.current != null) window.clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = window.setTimeout(() => {
      resumeTimerRef.current = null
      // 焦点还在横条里（卡片或箭头）时不恢复。
      if (wrapperRef.current?.contains(document.activeElement)) return
      pausedRef.current = false
      setPaused(false)
    }, delay)
  }

  useEffect(
    () => () => {
      if (resumeTimerRef.current != null) window.clearTimeout(resumeTimerRef.current)
    },
    [],
  )

  // 量一组卡片的宽度与溢出状态。滚动监听单独拆开：自动滚动每帧都会触发
  // scroll，如果每次都在里面读布局，等于每帧强制同步排版。
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const measure = () => {
      const cardWidth = track.firstElementChild?.getBoundingClientRect().width ?? 0
      // 一组的实际宽度：n 张卡 + (n−1) 个组内 gap。用来判断内容是否放得下。
      const setWidth =
        cardWidth > 0 && items.length > 0
          ? items.length * cardWidth + (items.length - 1) * CARD_GAP
          : 0
      // 回绕距离要跨过 n 个 gap（包括第二组第一张卡前面的那个），
      // 且一组必须比容器宽，滚动到 loop 时才有足够的第二组垫在后面。
      const canLoop =
        !reducedMotion &&
        items.length > 1 &&
        cardWidth > 0 &&
        setWidth > track.clientWidth + CARD_GAP
      loopWidthRef.current = canLoop ? items.length * (cardWidth + CARD_GAP) : 0
      setDuplicated(canLoop)
      setOverflowing(setWidth > track.clientWidth + 8)
      if (canLoop) {
        setAtStart(false)
        setAtEnd(false)
      } else {
        setAtStart(track.scrollLeft <= 4)
        setAtEnd(track.scrollLeft + track.clientWidth >= track.scrollWidth - 4)
      }
    }

    const onScroll = () => {
      const loop = loopWidthRef.current
      // 箭头平滑滚到 loop、或用户拖到第二组时，把它等价地减回第一组。
      // 两组画面完全重合，这一步看不出跳变。
      if (loop > 0) {
        if (track.scrollLeft >= loop) track.scrollLeft -= loop
      } else {
        setAtStart(track.scrollLeft <= 4)
        setAtEnd(track.scrollLeft + track.clientWidth >= track.scrollWidth - 4)
      }
      // 自动滚动时位置由 rAF 维护；只有暂停时（拖动、吸附、箭头）才回读。
      if (pausedRef.current) posRef.current = track.scrollLeft
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    track.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      track.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
    }
  }, [items, reducedMotion])

  // 持续滚动循环：每帧推进一点，越过一组宽度就取模回绕。
  // 暂停时只是不推进，位置保留，恢复后从原地继续。
  useEffect(() => {
    const track = trackRef.current
    if (!track || reducedMotion || open) return

    let raf = 0
    let last = performance.now()
    posRef.current = track.scrollLeft

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      // 切回后台标签页再回来时 delta 会很大，截断到 0.1s，避免瞬移一大段。
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const loop = loopWidthRef.current
      if (!loop || pausedRef.current || document.hidden) return
      let pos = posRef.current + AUTO_SCROLL_SPEED * dt
      if (pos >= loop) pos -= loop
      posRef.current = pos
      track.scrollLeft = pos
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reducedMotion, open])

  // 点箭头切换一张卡：位移一个卡位；越过两端时瞬时接回另一侧。
  const scrollByCard = (direction: -1 | 1) => {
    const track = trackRef.current
    if (!track) return
    const step = (track.firstElementChild?.getBoundingClientRect().width ?? 0) + CARD_GAP
    const loop = loopWidthRef.current
    if (step <= 0) return

    let target = track.scrollLeft + direction * step
    let instant = reducedMotion
    if (loop > 0) {
      if (target < 0) {
        target += loop
        instant = true
      } else if (target > loop) {
        target -= loop
        instant = true
      }
      // 正好落在 loop 上时照常平滑滚过去：那里的画面与 0 完全相同，
      // scroll 监听会把位置减回 0，看不出跳变。
    }
    track.scrollTo({ left: target, behavior: instant ? 'auto' : 'smooth' })
  }

  // 桌面鼠标拖动。原生横向滚动只认滚轮和触控板，按住拖动要自己接；
  // 触摸与手写笔继续走浏览器原生的甩动，因此拖动只认 mouse。
  const dragRef = useRef<{
    startX: number
    startLeft: number
    moved: boolean
    captured: boolean
  } | null>(null)
  const draggedAtRef = useRef(0)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // 任何指针按下都先停住自动滚动，手机才点得中正在移动的卡。
    pauseAuto()
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
    // 手机没有 hover，pointerup 之后延迟恢复，给惯性滚动留出时间。
    if (e.pointerType !== 'mouse') scheduleResume(900)
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
    // 松手后落到最近的卡位，和触摸甩动的停点一致。
    const step = (track.firstElementChild?.getBoundingClientRect().width ?? 0) + CARD_GAP
    if (step > 0) {
      track.scrollTo({
        left: Math.round(track.scrollLeft / step) * step,
        behavior: reducedMotion ? 'auto' : 'smooth',
      })
    }
  }

  const onBlur = (e: ReactFocusEvent<HTMLDivElement>) => {
    // 焦点在横条内部移动时不要恢复；真正离开才继续滚。
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      scheduleResume(0)
    }
  }

  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    // 拖动松手时浏览器仍会在落点补一次 click，它不该被读成「点了这张卡」。
    if (Date.now() - draggedAtRef.current < 250) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  // 自动滚动时关掉吸附，否则每帧写 scrollLeft 都会被拉回卡位；
  // 悬停 / 触摸 / 聚焦后暂停，吸附重新生效，松手停点才整齐。
  const autoScrolling = overflowing && !reducedMotion && !paused && !open

  // 只有需要回绕时才渲染两组续接。
  const rendered = duplicated ? [...items, ...items] : items

  return (
    <section>
      {/* 区块标题：参考图里这一块是居中的品牌红图形标题，因此标题居中、
           用品牌红而不是墨黑；「全部」压在右端（绝对定位）才能保住居中。
           图形标题 high_price.png 已随静态资源迁到 public/，与源站同一张图。 */}
      <div className="relative mb-2 flex items-center justify-center md:mb-4">
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
      {/* 箭头是滚动区的兄弟节点：滚动区带右缘 mask，箭头放里面会被一起渐隐。
          暂停逻辑挂在外层，鼠标从卡片移到箭头上时不会误恢复自动滚动。 */}
      <div
        ref={wrapperRef}
        className="relative"
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') pauseAuto()
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') scheduleResume(0)
        }}
        onFocusCapture={pauseAuto}
        onBlurCapture={onBlur}
      >
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
          // 拖动时也不能吸附，否则每次改 scrollLeft 都会被拉回卡位。
          style={dragging || autoScrolling ? { scrollSnapType: 'none' } : undefined}
          // 滚动条隐藏但滚动保留：右缘渐隐与箭头已经承担「还能往右」的提示，
          // 露出系统滚动条会在卡片下方多出一条横线。
          className={`flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong ${overflowing ? 'strip-fade' : ''} ${dragging ? 'cursor-grabbing select-none' : 'sm:cursor-grab'}`}
        >
          {rendered.map((c, index) => {
            // 第二组是纯续接用的重复卡：视觉上照常可点（看不出哪张是复制），
            // 但不进读屏与 Tab 顺序，避免同一张卡被念两遍。
            const cloned = index >= items.length
            return (
              // 卡位 227px：内容列 1200 − 4 × gap 16 = 1136，5 张正好铺满首屏
              //（设计图卡位 228，1px 取整差落在右缘渐隐里）。
              <div
                key={`${cloned ? 'clone' : 'card'}-${c.id}`}
                className="w-[calc((100%_-_2rem)/3)] shrink-0 snap-start sm:w-[227px]"
              >
                <HighValueCard card={c} locale={locale} onOpen={setOpen} ariaHidden={cloned} />
              </div>
            )
          })}
        </div>

        {/* 只有内容真正溢出时才出现箭头，且只在桌面显示；手机用横向甩动切换。 */}
        {overflowing && (
          <>
            <button
              type="button"
              aria-label={t('stripPrev')}
              disabled={!duplicated && atStart}
              onClick={() => scrollByCard(-1)}
              className="absolute left-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-fg shadow-md transition-[opacity,background-color] duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong sm:flex"
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
              disabled={!duplicated && atEnd}
              onClick={() => scrollByCard(1)}
              className="absolute right-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-fg shadow-md transition-[opacity,background-color] duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong sm:flex"
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
