import type { DefaultServerCellComponentProps } from 'payload'
import React from 'react'

import { AdminLocalDateTime } from './AdminLocalDateTime'

/**
 * Payload 自带的 DateCell 在 SSR 阶段按服务器 TZ 渲染，UTC 服务器上会先把
 * 12:30 输出成 04:30，水合后才跳回 12:30。这里把格式化交给客户端按运营时区完成。
 */
export function AdminDateCell({ cellData }: DefaultServerCellComponentProps) {
  if (cellData == null || cellData === '') return null
  return (
    <span>
      <AdminLocalDateTime value={cellData as string | number | Date} />
    </span>
  )
}
