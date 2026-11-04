'use client'

import { useEffect, useState } from 'react'

import { useT } from '@/lib/i18n/client'

/**
 * 深浅色切换。唯一真相是 `<html class="dark">`，写着一份就会被无闪烁脚本
 * 与 CSS 令牌（`.dark { ... }`）同时读到。
 *
 * 样式按「品牌红顶栏里的白色图标按钮」写——本组件目前只用在顶栏。
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const t = useT()
  // 仅用于 aria-label。服务端与首帧都取 false，挂载后再从 DOM 读真实值，
  // 因此不会出现「渲染期读 document」导致的水合不一致。
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      /* localStorage 不可用（隐私模式）时忽略，主题只是这次会话内有效 */
    }
    setDark(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? t('themeToLight') : t('themeToDark')}
      aria-pressed={dark}
      className={`inline-flex h-9 w-9 items-center justify-center rounded text-white transition hover:bg-white/15 hover:text-white ${className}`}
    >
      {/* 月亮：深色时显示。两个图标同时渲染，由 CSS 决定可见性，
          因此没有「首帧图标不对、水合后跳变」的问题。 */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="hidden dark:block"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
      </svg>
      {/* 太阳：浅色时显示 */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="block dark:hidden"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    </button>
  )
}
