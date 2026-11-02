import { LogOut } from 'lucide-react'
import type { Payload, SanitizedPermissions } from 'payload'
import React from 'react'

import { AdminNavLinks, AdminNavShell, type AdminNavItem } from './AdminNavLinks'
import { ENTITY_ICONS } from './entity-meta'

type Props = {
  payload: Payload
  permissions: SanitizedPermissions
  visibleEntities: { collections: string[]; globals: string[] }
}

/** 集合标签可能是字符串，也可能是 { zh, en, ja }。取当前界面语言那一份。 */
function toLabel(label: unknown, fallback: string): string {
  if (typeof label === 'string') return label
  if (label && typeof label === 'object') {
    const record = label as Record<string, unknown>
    for (const key of ['zh', 'en', 'ja']) {
      if (typeof record[key] === 'string') return record[key] as string
    }
  }
  return fallback
}

const ICON_KEYS = Object.keys(ENTITY_ICONS) as (keyof typeof ENTITY_ICONS)[]

/**
 * 后台侧栏：**一级菜单，一层到底**。
 *
 * 替换 Payload 默认的 `Nav`：默认实现会把集合按 `admin.group` 分成
 * 「系统 / 素材 / 分类 / 商品 / 内容 / 设置」六组，每组一个可折叠的二级菜单。
 * 13 个入口分成六摞之后，每次找东西都要「先展开、再找」，而运营每天进的
 * 其实是固定的那两三个集合——多出来的这一层只有成本。
 *
 * 这里把集合与全局摊成一条平铺列表（顺序 = 配置顺序），登出仍在底部。
 * 权限与 `visibleEntities` 的过滤与默认实现同一套规则，只是不再分组。
 */
export function AdminNav({ payload, permissions, visibleEntities }: Props) {
  const { admin: adminRoute } = payload.config.routes

  // 工作台（仪表盘）不是集合也不是全局，所以 Payload 的 navGroups 里没有它——
  // 换成平铺菜单之后，回 /admin 的唯一路径成了面包屑里那个没有文字的首页图标。
  // 它是一级菜单里最该在的第一项，单独加进来，并且只按**完全匹配**判当前项
  // （前缀匹配会让它在所有页面上都亮着）。
  const items: AdminNavItem[] = [
    {
      href: adminRoute,
      icon: 'dashboard',
      label: '工作台',
      slug: 'dashboard',
      exact: true,
    },
  ]

  for (const collection of payload.config.collections) {
    const { slug } = collection
    if (!visibleEntities.collections.includes(slug)) continue
    if (!permissions?.collections?.[slug]?.read) continue
    items.push({
      href: `${adminRoute}/collections/${slug}`,
      icon: ICON_KEYS.includes(slug as keyof typeof ENTITY_ICONS)
        ? (slug as keyof typeof ENTITY_ICONS)
        : null,
      label: toLabel(collection.labels?.plural, slug),
      slug,
    })
  }

  for (const global of payload.config.globals) {
    const { slug } = global
    if (!visibleEntities.globals.includes(slug)) continue
    if (!permissions?.globals?.[slug]?.read) continue
    items.push({
      href: `${adminRoute}/globals/${slug}`,
      icon: ICON_KEYS.includes(slug as keyof typeof ENTITY_ICONS)
        ? (slug as keyof typeof ENTITY_ICONS)
        : null,
      label: toLabel(global.label, slug),
      slug,
    })
  }

  return (
    <AdminNavShell>
      <nav className="nav__wrap">
        <AdminNavLinks items={items} />
        {/* Payload 自带的 <Logout /> 是一颗没有文字的图标（22px），
            贴在侧栏最底下，容易被当成装饰——用户因此以为「没有登出」。
            同一条 /admin/logout 路由，换成带文字的入口。 */}
        <div className="nav__controls">
          <a className="admin-nav__logout" href={`${adminRoute}/logout`}>
            <LogOut className="admin-nav__icon" />
            登出
          </a>
        </div>
      </nav>
    </AdminNavShell>
  )
}
