/**
 * 展示用的数值格式化。
 *
 * 这里只做一件事：把后台存的价格变成人读得懂的一串字符。
 *
 * 为什么是整数日元：后台价格是 JPY（种子数据 `price: 880.00`，Directus 的
 * decimal 类型自带两位小数）。全站曾原样渲染成 `¥880.00`——TCG 卡牌没有
 * 分这个单位，买家每看一张卡都要在脑内去掉两位小数，价格就从「一眼可读」
 * 退化成了「需要处理」。卡牌金额跨度从几十日元到几十万日元，两位小数
 * 在这里只增加噪声，不承载任何信息。
 *
 * 语言无关：日元符号与千分位在三语里写法一致（`¥880` / `¥1,280,000`），
 * 所以不放进 i18n 字典，避免三份一模一样的数据各写一遍。
 */
export function formatYen(value: number | null | undefined): string {
  if (value == null) return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 }).format(n)
}
