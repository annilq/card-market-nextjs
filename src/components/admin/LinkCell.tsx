import type { DefaultServerCellComponentProps } from 'payload'
import React from 'react'

import { publicPathFor } from '@/lib/admin/public-links'

import { LinkCellClient } from './LinkCellClient'

/**
 * 列表里的「链接」列。服务端组件，只做一件事：把当前行拼成前台路径。
 *
 * 拼不出来（集合没有前台页面，或缺 id）时不渲染任何东西，这一列就是空的，
 * 不会出现一个点了 404 的假链接。拼链接的规则集中在 public-links.ts。
 */
export function LinkCell({ rowData, collectionSlug }: DefaultServerCellComponentProps) {
  const path = publicPathFor(collectionSlug ?? '', (rowData ?? {}) as Record<string, unknown>)
  if (!path) return null
  return <LinkCellClient path={path} />
}
