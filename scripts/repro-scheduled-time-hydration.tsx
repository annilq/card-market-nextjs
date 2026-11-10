/**
 * 水合回归检查：SSR 只输出占位符，客户端按浏览器时区换成运营输入的墙上时间，
 * 且不能触发 React 水合不一致。用不同 TZ 模拟不同地区的运营浏览器。
 *
 * `TZ=Asia/Tokyo node --import ./scripts/css-stub.mjs --import tsx scripts/repro-scheduled-time-hydration.tsx`
 * happy-dom 是 @payloadcms/richtext-lexical 经 @lexical/headless 带入的依赖。
 */
import { Window } from 'happy-dom'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import React from 'react'

import { AdminLocalDateTime } from '../src/components/admin/AdminLocalDateTime'

const win = new Window({ url: 'http://localhost' })
const g = globalThis as unknown as Record<string, unknown>
for (const key of [
  'window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Text',
  'Comment', 'DocumentFragment', 'Event', 'CustomEvent', 'MutationObserver',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle',
]) {
  Object.defineProperty(g, key, {
    value: (win as unknown as Record<string, unknown>)[key],
    configurable: true,
    writable: true,
  })
}
g.IS_REACT_ACT_ENVIRONMENT = false

const errors: string[] = []
const originalError = console.error
console.error = (...args: unknown[]) => {
  errors.push(args.map(String).join(' '))
}

const datePart = '2026-12-10'
const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone
// 模拟运营在自己的浏览器里输入 12:30：日期选择器把该墙上时间转成一个 UTC 瞬时。
const naiveUtc = Date.parse(`${datePart}T12:30:00.000Z`)
const offsetMinutes = new Date(naiveUtc).getTimezoneOffset()
const stored = new Date(naiveUtc + offsetMinutes * 60_000).toISOString()
const expected = `${datePart} 12:30`

const element = <span>定时 · <AdminLocalDateTime value={stored} /></span>
const html = renderToString(element)
const container = win.document.createElement('div')
container.innerHTML = html
win.document.body.appendChild(container)

console.log('SSR HTML        :', html)
console.log('浏览器时区      :', browserZone)
console.log('该时区应显示    :', expected)

hydrateRoot(container as unknown as Element, element)
await new Promise((resolve) => setTimeout(resolve, 100))

console.error = originalError
const shown = container.textContent
console.log('水合后 DOM 文本 :', shown)
const mismatch = errors.some((e) => e.includes('Hydration failed') || e.includes('did not match'))
console.log('水合不一致报错  :', mismatch ? '有' : '无')

if (mismatch) {
  console.error('FAIL: 出现水合不一致')
  process.exit(1)
}
if (shown !== `定时 · ${expected}`) {
  console.error(`FAIL: 期望 定时 · ${expected}`)
  process.exit(1)
}
console.log('PASS: 水合后按浏览器时区显示，且无水合不一致')
