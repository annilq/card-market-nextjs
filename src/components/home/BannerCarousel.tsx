'use client'

// 首页 banner 轮播（从 TanStack Start 版移植）。
//
// 版式与「为什么这样」的判断原样保留，只换了三处实现方式：
// - 图片 URL 来自 Payload（ImageView.bannerUrl 已经是 banner 尺寸，不再走 assetUrl 拼参）；
// - 站内链接改用 next/link，路径补语言段仍走 localizeHref；
// - `useReducedMotion` 没有对应的共享 lib（Next 版 src/lib 下没有它），
//   因此作为本文件的局部 hook 实现，行为与源站一致。

import { useEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { useLocale, useT } from '@/lib/i18n/client'
import { localizeHref } from '@/lib/i18n/locales'
import type { BannerView } from '@/lib/types'

/** 自动轮播间隔。源站是写死的前端常量（无用户操作每 5 秒换一张），移植时同样不进后台配置。 */
const AUTOPLAY_MS = 5000

/** 环形最短距离：从激活 idx 到 i 的有符号偏移，用于桌面「居中聚光」布局。 */
function bannerOffset(idx: number, i: number, n: number): number {
  if (n <= 1) return 0
  let d = (i - idx) % n
  if (d < 0) d += n
  if (d > n / 2) d -= n
  return d
}

/** 居中聚光：把偏移换算成 CSS 变量（位移/缩放/透明度/亮度/层级）。
 *  对应方案 A「聚光居中」、中等虚化（与 demo 一致）：邻图缩 16%、半透明 + 压暗。 */
type BannerVars = CSSProperties &
  Record<'--bx' | '--bs' | '--bo' | '--bb' | '--bz', string>

function bannerSlideStyle(off: number): BannerVars {
  const a = Math.abs(off)
  if (off === 0) {
    return { '--bx': '0%', '--bs': '1', '--bo': '1', '--bb': '1', '--bz': '30' }
  }
  // 距激活图 ±1 / ±2 的横向错位：42% / 76%。
  const sign = off > 0 ? 1 : -1
  const bx = (a === 1 ? 42 : 76) * sign
  const bs = 1 - 0.16 * a // 每远一层缩小 16%
  const bo = Math.max(0, 1 - 0.55 * (0.55 * a)) // 半透明
  const bb = 1 - 0.35 * a // 压暗
  const bz = 30 - a * 10
  return {
    '--bx': `${bx}%`,
    '--bs': bs.toFixed(3),
    '--bo': bo.toFixed(3),
    '--bb': bb.toFixed(3),
    '--bz': String(bz),
  }
}

/**
 * 系统是否要求「减少动态效果」。
 *
 * 为什么不只靠 CSS：CSS 媒体查询能关掉 transition 与 animation，但关不掉
 * **由 JS 驱动的循环**——banner 自动轮播就是典型。它每 5 秒改变一次页面内容，
 * 对前庭敏感的用户来说是最难受的一类运动，而 `@media` 管不到 `setInterval`。
 *
 * 初始值取 `false`（服务端与首帧），挂载后再读真实值：服务端没有 `matchMedia`，
 * 若在渲染期读它，SSR 输出与客户端首帧会不一致。
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    // 用户在系统设置里改了偏好时立即生效，不需要刷新页面。
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return reduced
}

export function BannerCarousel({ banners }: { banners: BannerView[] }) {
  const t = useT()
  const locale = useLocale()
  const [idx, setIdx] = useState(0)
  // 轮播的开关：只在能自动动、鼠标没停在上面、也没被键盘聚焦时才走。
  // 自动轮播是「无用户操作就改变内容」，无障碍上必须能被停住——悬停/键盘聚焦暂停、
  // 减少动态时干脆不走、手动切换后重新计时。
  const [paused, setPaused] = useState(false)
  // 每次手动切换（滑动或点圆点）自增，让下面的计时器重新开始：
  // 用户刚切到的那张能完整停留 5 秒，而不是切完立刻又被自动轮播换走。
  const [tick, setTick] = useState(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (banners.length <= 1 || paused || reduced) return
    const timer = setInterval(
      () => setIdx((i) => (i + 1) % banners.length),
      AUTOPLAY_MS,
    )
    return () => clearInterval(timer)
  }, [banners.length, paused, reduced, tick])

  // 切到第 i 张（支持循环）并重启自动轮播计时。滑动与圆点共用这一个入口，
  // 「手动切换 → 重新计时」这条规则因此只有一处实现。
  const goTo = (i: number) => {
    const n = banners.length
    if (n === 0) return
    setIdx(((i % n) + n) % n)
    setTick((t) => t + 1)
  }

  // 触摸滑动切换。只认 touch/pen，不劫持鼠标——桌面端保持
  // 「点圆点切换、点整块进链接」的原语义。
  // 收尾挂在 window 的 pointerup 上：banner 只有 21:9 一条很矮，
  // 手指横向划出边界时元素自身收不到事件，window 一定收得到。
  // 纵向拖动交给浏览器滚动（section 上是 touch-action: pan-y），
  // 浏览器接管滚动时会发 pointercancel，于是放弃这次切换。
  const swipeStart = useRef<{ id: number; x: number; y: number } | null>(null)
  // 滑动后浏览器仍可能补发一次 click，落在 banner 链接上会误跳转：
  // 用这个标记在捕获阶段把那次 click 吃掉，下一次 pointerdown 再复位。
  const swiped = useRef(false)

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    // 任何新的指针按下都先清掉「上一次滑动残留的吃 click 标记」：
    // 否则一次滑动之后的鼠标点击（如桌面点圆点）会被误吞。
    swiped.current = false
    if (e.pointerType === 'mouse') return
    const start = { id: e.pointerId, x: e.clientX, y: e.clientY }
    swipeStart.current = start

    const finish = (ev: PointerEvent) => {
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel)
      if (swipeStart.current !== start) return
      swipeStart.current = null
      const dx = ev.clientX - start.x
      const dy = ev.clientY - start.y
      // 横向位移够大、且明显大于纵向（否则是在滚页面），才认作切换。
      if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        swiped.current = true
        goTo(idx + (dx < 0 ? 1 : -1)) // 左滑看下一张，右滑看上一张
      }
    }
    const cancel = () => {
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel)
      if (swipeStart.current === start) swipeStart.current = null
    }
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
  }

  // 吃掉滑动后补发的那次 click，避免误触 banner 链接跳走。
  const onClickCapture = (e: ReactMouseEvent<HTMLElement>) => {
    if (!swiped.current) return
    swiped.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <section
      className="banner-stage"
      data-single={banners.length === 1 ? 'true' : undefined}
      // 只在能悬停的设备（桌面）上用悬停暂停：手机触摸会合成 mouseenter，
      // 若不加此闸门，手指点一下圆点/滑动后自动播放就被永久停掉。
      onMouseEnter={() => {
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
          setPaused(true)
        }
      }}
      onMouseLeave={() => {
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
          setPaused(false)
        }
      }}
      // 只有键盘聚焦才暂停：鼠标/手指点按钮不该把自动播放永久停掉，
      // 否则手机用户点一次圆点后就再也看不到轮播了。
      onFocus={(e) => {
        if (
          e.target instanceof HTMLElement &&
          e.target.matches(':focus-visible')
        ) {
          setPaused(true)
        }
      }}
      onBlur={() => setPaused(false)}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
    >
      {banners.map((b, i) => {
        const src = b.image?.bannerUrl || b.image?.url
        const n = banners.length
        const off = bannerOffset(idx, i, n)
        const a = Math.abs(off)
        const isActive = i === idx
        const hidden = a > 2 // 离激活图超过两张（环形）的幻灯：隐藏且不可点。
        const near = a === 1 || a === 2 // 两侧相邻图：桌面可点击切换。
        const inner = (
          <>
            {src && (
              <Image
                src={src}
                alt={b.title || 'banner'}
                fill
                // 首张是首屏主图（LCP）：priority 让优化器预加载并直出 AVIF/WebP，
                // 其余幻灯等进入视口再加载，避免一次性预拉全部轮播大图。
                priority={i === 0}
                sizes="100vw"
                className="object-cover"
              />
            )}
            {/* 图上文字：压一层足够深的渐隐黑色再写字。
                 之前是 from-black/60，深色主题下与图片的深色区域叠在一起，
                 实测对比度只有 1.23:1——文字几乎消失。改成底部实心、向上渐隐。 */}
            {/* 圆点已移到舞台底部正中，文字无需再为其让位。 */}
            {(b.title || b.description) && (
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/55 to-transparent p-4 text-white sm:p-6">
                {b.title && (
                  <div className="text-lg font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] sm:text-xl">
                    {b.title}
                  </div>
                )}
                {b.description && (
                  <div className="line-clamp-2 text-sm text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    {b.description}
                  </div>
                )}
              </div>
            )}
          </>
        )
        // 每张幻灯都是绝对定位的层；桌面下由 CSS 变量决定它相对于激活位的
        // 位移/缩放/透明度/亮度，移动端靠 data-active 做交叉淡入。
        const slide = (
          <div
            className={`banner-slide ${hidden ? 'is-hidden' : ''} ${
              near ? 'is-near' : ''
            }`}
            data-active={isActive ? 'true' : undefined}
            style={n === 1 ? undefined : bannerSlideStyle(off)}
            aria-hidden={isActive ? undefined : 'true'}
            onClick={(e) => {
              if (!isActive) {
                e.preventDefault()
                e.stopPropagation()
                goTo(i)
              }
            }}
          >
            {inner}
          </div>
        )
        // 激活图若有链接则整块可点进去；其余侧图只是「点击切换到它」，不导航。
        if (isActive && b.link) {
          return b.link.startsWith('/') ? (
            // b.link 来自后台内容，绕过路由类型，需补语言段，否则会掉回默认语言。
            <Link key={b.id} href={localizeHref(b.link, locale)}>
              {slide}
            </Link>
          ) : (
            <a key={b.id} href={b.link} target="_blank" rel="noreferrer">
              {slide}
            </a>
          )
        }
        return <div key={b.id}>{slide}</div>
      })}
      {banners.length > 1 && (
        // 圆点：视觉上仍是一排小点，但每个热区 36×36（WCAG 2.5.8 要求 24×24，
        // 手机拇指也更好点），位置在底部渐变最暗处，白点在任意图上都有对比。
        // 当前项用「加宽」而非换色区分，灰度或色觉差异下同样可辨。
        // 左右箭头键也能切换（键盘用户 tab 到圆点后可直接操作）。
        <div
          className="absolute bottom-2 left-1/2 z-40 flex -translate-x-1/2 items-center"
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault()
              goTo(idx - 1)
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              goTo(idx + 1)
            }
          }}
        >
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={t('bannerAria', { n: i + 1 })}
              aria-current={i === idx ? 'true' : undefined}
              className="group/dot flex h-9 w-9 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span
                className={`h-2 rounded-full transition-all duration-200 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] ${
                  i === idx
                    ? 'w-6 bg-white'
                    : 'w-2 bg-white/60 group-hover/dot:bg-white/90'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
