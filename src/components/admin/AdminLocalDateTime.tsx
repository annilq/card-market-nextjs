'use client'

import React, { useEffect, useState } from 'react'

import { formatAdminDateTime } from '@/lib/admin/date-time'

/**
 * 后台时间按运营浏览器时区显示，跟日期选择器同源，所以填 12:30 就看到 12:30，
 * 与项目部署在哪个国家、服务器进程 TZ 是什么都无关。
 *
 * 服务端拿不到浏览器时区，首帧先输出占位符；水合后换成运营本地值。
 * 两端首帧文本一致，既不触发 React 水合不一致，也不会闪出一个错误的时间。
 */
export function AdminLocalDateTime({ value }: { value: string | number | Date }) {
  const [text, setText] = useState('…')

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    setText(formatAdminDateTime(value, timeZone))
  }, [value])

  return <>{text}</>
}
