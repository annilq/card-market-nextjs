/**
 * 卡牌类型（后台 `card-statuses`）徽章配色。
 *
 * 状态是后台可增删的自由文本，设计图只给了三种；因此这里按名称做一次归一化
 * 匹配，认不出来的状态回到品牌红——宁可少一种颜色，也不要让某个新状态变成
 * 透明/无底色。匹配用大写后的关键词，中日英任一写法的常见词都收进来。
 *
 * 横条卡与网格卡共用同一套颜色，避免同一个「PSA10」在两处显示成两种颜色。
 */
export function statusBadgeClass(name: string | null): string {
  const n = (name ?? '').trim().toUpperCase()
  if (!n) return 'bg-brand'
  if (/PSA|GRAD|鑑定|鉴定/.test(n)) return 'bg-[#db261d]'
  if (/裸|RAW|BARE|SINGLE|未鑑定|未鉴定/.test(n)) return 'bg-[#1a2aff]'
  if (/BOX|PACK|SEAL|包装|未開封|未开封/.test(n)) return 'bg-[#28c83b]'
  return 'bg-brand'
}
