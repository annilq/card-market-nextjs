import type { DefaultServerCellComponentProps } from 'payload'
import React from 'react'

import { linkCellModel } from '@/lib/admin/public-links'

import { LinkCellClient } from './LinkCellClient'

/**
 * 前台此刻是否真的能看到这条记录。
 *
 * 只有 status=published 才可见；公告还要看发布时间是否已到（未来时间是定时发布，
 * 现在点进去是 404）。没有 status 字段的集合视为可见。
 */
function isPubliclyVisible(rowData: Record<string, unknown>): boolean {
  const raw = rowData.status
  if (raw == null) return true
  if (raw !== 'published') return false
  const publishedAt = rowData.publishedAt
  if (publishedAt == null) return true
  const time = new Date(publishedAt as string).getTime()
  return !Number.isFinite(time) || time <= Date.now()
}

/**
 * 列表里的「链接」列。服务端组件，把当前行解析成一个可展示 / 复制的地址。
 *
 * 两种语义，见 linkCellModel：
 * - banner：展示这条 banner 自己配置的跳转 link（运营关心的就是它跳到哪）。
 * - 其它集合：展示这条记录自己的前台地址，并按发布状态判断现在点开会不会 404。
 *
 * 拼不出来（集合没有前台页面，或缺 id，或 banner 没填 link）时不渲染可复制地址。
 */
export function LinkCell({ rowData, collectionSlug }: DefaultServerCellComponentProps) {
  const row = (rowData ?? {}) as Record<string, unknown>
  const slug = collectionSlug ?? ''
  const { href, label, isBannerLink } = linkCellModel(slug, row)

  // banner 的 link 是运营配置的跳转目标，打开它不需要「是否发布」提醒；
  // 其它集合展示的是记录自己的前台地址，按可见性决定打开前要不要拦一下。
  const visible = isBannerLink ? true : isPubliclyVisible(row)

  if (!label) return null
  return <LinkCellClient href={href} label={label} visible={visible} onlyCopyable={href == null} />
}
