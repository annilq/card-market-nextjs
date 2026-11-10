/**
 * UTC 瞬时 → `YYYY-MM-DD HH:mm`，按传入时区格式化。
 *
 * `timeZone` 必须由调用方给出运营浏览器的时区，也就是日期选择器使用的那个时区。
 * 服务端进程 TZ 由部署环境决定（Vercel / Docker 是 UTC），拿它来取墙上时间就是
 * 「填 12:30 显示 04:30」的根因。模块级缓存 Intl 实例会锁死创建时的 TZ，所以
 * 每次调用都要重建。
 *
 * 入参必须是带时区的 ISO 串、毫秒数或 Date；不带时区的字符串由 `new Date`
 * 按 UTC 或服务器本地解释，结果会漂移。
 */
export function formatAdminDateTime(
  value: string | number | Date | null | undefined,
  timeZone: string,
): string {
  if (value == null) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`
}
