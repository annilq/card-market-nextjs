'use client'

// 浮层（dialog / sheet / modal）的公共行为，三处浮层共用这一份：
//   - Esc 关闭；
//   - 打开期间锁背景滚动，关闭时还原成打开前的那个值；
//   - 打开时把焦点移进浮层，关闭时还给触发它的那个元素；
//   - Tab / Shift+Tab 圈在浮层内（可关，见 `trapFocus`）。
//
// 这里只有行为，没有外观：class、动画与 DOM 结构仍留在调用方，
// 因此把三份内联实现换成这一个 hook 不会改动任何一处渲染结果。
//
// 减少动态效果：浮层自身的入场动画在 CSS 里（`globals.css` 的 `.sheet-fade` /
// `.sheet-in` / `.modal-in`，以及 FilterSheet 就近声明的 `.sheet-up`），
// hook 这边唯一可能带出位移的是「聚焦时浏览器把元素滚进视野」，
// 因此只在这一处读 matchMedia 并关掉滚动（见下方 `preventScroll`）。

import { useEffect, useRef, type RefObject } from 'react'

/** 浮层里可聚焦元素的范围：只收看得见的（隐藏/disabled 的不算）。 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface UseDialogOptions {
  /** 浮层是否打开。关闭时不挂监听、不动 body，也不碰焦点。 */
  open: boolean
  onClose: () => void
  /** 浮层容器（带 `tabIndex={-1}`，焦点先落在它上面）。 */
  containerRef: RefObject<HTMLElement | null>
  /**
   * 是否把 Tab 圈在浮层内，默认 true。
   * FilterSheet 传 false：它移植时就没有焦点陷阱，本次是纯重构，行为照旧。
   */
  trapFocus?: boolean
}

function visibleFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  )
}

/** 读一次「减少动态效果」：直接问 matchMedia，不用 state，首帧也能读到正确值。 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useDialog({
  open,
  onClose,
  containerRef,
  trapFocus = true,
}: UseDialogOptions): void {
  // 回调走 ref：调用方通常传内联箭头函数，直接进依赖数组会让 effect 每次渲染重跑
  // （表现为焦点被反复抢回浮层）。
  const close = useRef(onClose)
  close.current = onClose
  const trap = useRef(trapFocus)
  trap.current = trapFocus

  useEffect(() => {
    if (!open) return

    const previous = document.activeElement as HTMLElement | null

    // 焦点必须进浮层，否则键盘与读屏用户还站在身后的那张页面上。
    // 容器本身（tabIndex={-1}）优先；它不可聚焦时退回第一个可聚焦元素。
    const root = containerRef.current
    if (root) {
      const options: FocusOptions | undefined = prefersReducedMotion()
        ? { preventScroll: true }
        : undefined
      root.focus(options)
      if (document.activeElement !== root) visibleFocusable(root)[0]?.focus(options)
    }

    // 锁背景滚动：手指在浮层里滑动不该把身后的页面一起带走。
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close.current()
        return
      }
      if (!trap.current || e.key !== 'Tab') return
      const el = containerRef.current
      if (!el) return
      // 焦点陷阱：走到末尾再往下、Shift+Tab 到头，都绕回浮层另一端，
      // 而不是落到身后的页面上。
      const items = visibleFocusable(el)
      if (items.length === 0) {
        e.preventDefault()
        el.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && (active === first || active === el)) {
        e.preventDefault()
        last.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, containerRef])
}
