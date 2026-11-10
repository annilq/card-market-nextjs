/**
 * 「填 12:30 就看到 12:30」的回归检查。
 *
 * 日期选择器按运营浏览器的本地墙上时间取值，存成 UTC 瞬时。后台两处列表
 * 单元格由服务端组件渲染，SSR 拿不到浏览器时区，所以只输出占位符，水合后
 * 由客户端按浏览器时区格式化。任何服务器 TZ、任何运营时区下都不该出现错误时间。
 *
 * 用生产环境的 TZ 运行：
 *   `TZ=UTC node --import ./scripts/css-stub.mjs --import tsx scripts/repro-scheduled-time.tsx`
 */
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'

import { AdminDateCell } from '../src/components/admin/AdminDateCell'
import { StatusCell } from '../src/components/admin/StatusCell'
import { formatAdminDateTime } from '../src/lib/admin/date-time'

// 运营可能在任意时区。每个都按自己的浏览器输入 12:30。
const OPERATORS = [
  { zone: 'Asia/Shanghai', offset: '+08:00' },
  { zone: 'Asia/Tokyo', offset: '+09:00' },
  { zone: 'UTC', offset: '+00:00' },
  { zone: 'America/New_York', offset: '-05:00' },
]

// 取一个确定在未来的日期，保持和报障用例一致的「中午 12:30」墙上时间。
const day = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
const datePart = day.toISOString().slice(0, 10)
const nextDay = new Date(Date.parse(`${datePart}T00:00:00.000Z`) + 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10)
const shanghaiPicked = `${datePart}T12:30:00+08:00`
const stored = new Date(shanghaiPicked).toISOString()
const expected = `${datePart} 12:30`

const statusProps = {
  cellData: 'published',
  collectionSlug: 'announcements',
  collectionConfig: {},
  field: { type: 'select', options: [{ label: '已发布', value: 'published' }] },
  i18n: {},
  payload: {},
  rowData: { publishedAt: stored },
} as unknown as React.ComponentProps<typeof StatusCell>

const dateProps = {
  cellData: stored,
  collectionSlug: 'announcements',
  collectionConfig: {},
  field: {},
  i18n: {},
  payload: {},
  rowData: {},
} as unknown as React.ComponentProps<typeof AdminDateCell>

const badgeHtml = renderToStaticMarkup(<StatusCell {...statusProps} />)
const columnHtml = renderToStaticMarkup(<AdminDateCell {...dateProps} />)

const checks: [string, string | boolean, string | boolean][] = [
  ['SSR 胶囊输出占位符', badgeHtml.includes('…'), true],
  ['SSR 发布时间列输出占位符', columnHtml.includes('…'), true],
  ['SSR 胶囊不出现错误时间', !/\d{2}:\d{2}/.test(badgeHtml), true],
  ['SSR 发布时间列不出现错误时间', !/\d{2}:\d{2}/.test(columnHtml), true],
  ['空值', formatAdminDateTime(null, 'Asia/Tokyo'), '—'],
  ['非法值', formatAdminDateTime('not-a-date', 'Asia/Tokyo'), '—'],
  [
    '跨日零点',
    formatAdminDateTime(`${datePart}T15:00:00.000Z`, 'Asia/Tokyo'),
    `${nextDay} 00:00`,
  ],
  ['毫秒时间戳', formatAdminDateTime(Date.parse(stored), 'Asia/Shanghai'), expected],
]

for (const { zone, offset } of OPERATORS) {
  const picked = `${datePart}T12:30:00${offset}`
  const saved = new Date(picked).toISOString()
  checks.push([`${zone} 输入 12:30`, formatAdminDateTime(saved, zone), expected])
}

console.log(`服务器 TZ        : ${process.env.TZ ?? '(system)'}`)
console.log(`日期             : ${datePart}`)
console.log(`上海运营输入 12:30 -> 存 ${stored}`)
console.log(`SSR 胶囊         : ${badgeHtml.replace(/<[^>]*>/g, '').trim()}`)
console.log(`SSR 发布时间列   : ${columnHtml.replace(/<[^>]*>/g, '').trim()}`)
for (const { zone, offset } of OPERATORS) {
  const saved = new Date(`${datePart}T12:30:00${offset}`).toISOString()
  console.log(`${zone.padEnd(18)} -> 显示 ${formatAdminDateTime(saved, zone)}`)
}
console.log(`期望             : ${expected}`)

const failed = checks.filter(([, actual, want]) => actual !== want)
for (const [name, actual, want] of failed) {
  console.error(`FAIL ${name}: 应为 ${want}，实际 ${actual}`)
}
if (failed.length > 0) process.exit(1)
console.log(`\nPASS: ${checks.length} 项检查全部通过`)
