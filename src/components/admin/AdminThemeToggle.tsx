'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

/**
 * 后台深色模式切换按钮，挂在 `admin.components.actions`（顶栏右侧 actions 区）。
 *
 * 重要：后台主题与**前台**主题是两个独立系统——
 *   前台：`<html class="dark">` + `localStorage('theme')`
 *   后台：`<html data-theme="dark|light">` + cookie `payload-theme`
 *         （SSR 时 middleware / RootView 会读这个 cookie 种下 data-theme）
 * 所以这里只动 data-theme + payload-theme cookie，绝不能碰前台的 dark class / localStorage，
 * 否则两边会互相串味。
 */
export function AdminThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
  }, [])

  const toggle = () => {
    const next = !isDark
    setIsDark(next)
    const theme = next ? 'dark' : 'light'
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    // 同步写盘：刷新后 RootView 读这个 cookie 仍能还原主题。
    root.style.colorScheme = theme
    document.cookie = `payload-theme=${theme}; path=/; max-age=31536000; samesite=lax`
  }

  return (
    <button
      type="button"
      className="admin-theme-toggle"
      onClick={toggle}
      aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
      title={isDark ? '切换到浅色模式' : '切换到深色模式'}
    >
      {isDark ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
    </button>
  )
}
