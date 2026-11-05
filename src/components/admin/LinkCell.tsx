import type { DefaultServerCellComponentProps } from 'payload'
import React from 'react'

import { publicPathFor } from '@/lib/admin/public-links'

import { LinkCellClient } from './LinkCellClient'

/** 内容集合的三态。没有 status 字段的集合（如门店已统一发布）不参与判定。 */
type Status = 'archived' | 'draft' | 'published'

/**
 * 前台此刻是否真的能看到这条记录。
 *
 * 只有 status=published 才可见；公告还要看发布时间是否已到（未来时间是定时发布，
 * 现在点进去是 404）。服务端算好传给单元格，客户端据此决定「打开」前要不要提醒。
 * 没有 status 字段的集合视为可见。
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
 * 列表里的「链接」列。服务端组件，做两件事：把当前行拼成前台路径，判断它现在
 * 前台是否可见。拼不出来（集合没有前台页面，或缺 id）时不渲染，避免给出点了
 * 404 的假链接。拼链接的规则集中在 public-links.ts。
 */
export function LinkCell({ rowData, collectionSlug }: DefaultServerCellComponentProps) {
  const row = (rowData ?? {}) as Record<string, unknown>
  const path = publicPathFor(collectionSlug ?? '', row)
  if (!path) return null
  return <LinkCellClient path={path} visible={isPubliclyVisible(row)} />
}
