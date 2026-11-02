'use client'

// 后台侧栏的链接列。
//
// 之所以是个客户端组件：当前项要跟 `usePathname()` 比，而 Payload 的侧栏
// 在 ≤1440px 是「按需抽屉」（`nav--nav-hydrated` / `nav--nav-open` 由
// `useNav()` 提供），这两个状态只能在客户端读。
//
// 一级菜单只有一层：不做分组、不做折叠。分组来自各集合的 `admin.group`，
// 它把 13 个入口切成「系统 / 素材 / 分类 / 商品 / 内容 / 设置」六摞，
// 每次找东西都要先展开再找——运维每天进的是固定的那两三个集合，
// 多出来的一层只有成本。

import { Hamburger, Link, useNav } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'

import { ENTITY_DESCRIPTIONS, ENTITY_FALLBACK_ICON, ENTITY_ICONS } from './entity-meta'

export type AdminNavItem = {
  /** 只按完全匹配判当前项（工作台用：它的路径是所有页面的前缀）。 */
  exact?: boolean
  href: string
  icon: keyof typeof ENTITY_ICONS | null
  label: string
  slug: string
}

export function AdminNavLinks({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname()
  // 13 项平铺在 248px 里是一面墙：只靠一个 2px 红条区分，找东西得逐行读。
  // 与其把它重新折成二级菜单（文档里论证过那是另一种成本），不如给一个
  // 即时筛选框——结构不动，扫读成本降下来。
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    // 名称、slug、仪表盘里那句说明都能命中：运营更可能记得「放图片的」
    // 而不是集合的技术名。
    return items.filter((item) =>
      [item.label, item.slug, ENTITY_DESCRIPTIONS[item.slug] ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [items, query])

  return (
    <div className="admin-nav-wrap">
      {items.length > 8 && (
        <div className="admin-nav__search">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            className="admin-nav__search-icon"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="筛选集合"
            aria-label="筛选集合"
            className="admin-nav__search-input"
          />
        </div>
      )}

      {visible.length === 0 ? (
        <p className="admin-nav__empty">没有匹配的集合</p>
      ) : (
        <ul className="admin-nav">
          {visible.map((item) => {
        // Payload 的路径是 `/admin/collections/cards`，但列表还有
        // `/create`、`/trash` 等子路径；用前缀匹配而不是全等，
        // 进编辑页时当前项才不会丢。
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            pathname === `${item.href}/trash`
        const Icon = item.icon ? (ENTITY_ICONS[item.icon] ?? ENTITY_FALLBACK_ICON) : null

        return (
          <li key={item.slug}>
            <Link
              aria-current={isActive ? 'page' : undefined}
              className={`nav__link${isActive ? ' active' : ''}`}
              href={item.href}
              prefetch={false}
            >
              {isActive ? <span className="nav__link-indicator" /> : null}
              {Icon ? <Icon className="admin-nav__icon" /> : null}
              <span className="nav__link-label">{item.label}</span>
            </Link>
          </li>
          )
        })}
        </ul>
      )}
    </div>
  )
}

/**
 * 侧栏外壳。
 *
 * 复刻 Payload 内部 `NavWrapper` 的结构（`<aside class="nav"><div class="nav__scroll">`），
 * 因为 Payload 自己的 CSS 靠这几个类决定「≤1440px 收成抽屉、展开时才有
 * `--nav-hydrated / --nav-open`」。少了这些类，窄屏侧栏会一直 display:none。
 */
export function AdminNavShell({ children }: { children: React.ReactNode }) {
  const { hydrated, navOpen, navRef, setNavOpen, shouldAnimate } = useNav()

  /**
   * 桌面宽度上「挂载即展开」。
   *
   * Payload 的 NavProvider 在 ≤1440px 时会**异步**读一次「侧栏开合」偏好并覆盖它；
   * 只在挂载时设一次会被那次异步写覆盖掉——实测 1440×900 下侧栏回到 `opacity:0`
   * （`grid: 0px 1440px`），等于团队主力分辨率上根本没有菜单。
   *
   * 所以这里在头一秒里重设几次，赢下这个竞态；之后交回给用户，
   * 用户手动收起不会被抢回来，<1024 仍走 Payload 自己的抽屉逻辑。
   */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const desktop = () => window.matchMedia('(min-width: 1024px)').matches
    if (!desktop()) return
    let cancelled = false
    const timers = [0, 60, 200, 600, 1200].map((delay) =>
      window.setTimeout(() => {
        if (!cancelled && desktop()) setNavOpen(true)
      }, delay),
    )
    return () => {
      cancelled = true
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [setNavOpen])

  const classes = [
    'nav',
    navOpen && 'nav--nav-open',
    shouldAnimate && 'nav--nav-animate',
    hydrated && 'nav--nav-hydrated',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <aside className={classes} inert={!navOpen ? true : undefined}>
      <div className="nav__scroll" ref={navRef}>
        {children}
        {/* 窄屏抽屉的关闭按钮：与顶栏的汉堡是同一个 state 的两端。 */}
        <div className="nav__header">
          <div className="nav__header-content">
            <button
              className="nav__mobile-close"
              onClick={() => setNavOpen(false)}
              tabIndex={!navOpen ? -1 : undefined}
              type="button"
            >
              <Hamburger isActive />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
