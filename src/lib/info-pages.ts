// 审核用信息页的固定清单：运营信息 / 个人信息收集 / 利用规则 / 数据使用。
//
// 为什么在前端硬编码一份 key 清单，而不是完全由后台驱动：
// 页脚入口与路由 `/info/<key>` 需要在「后台还没有数据」时也能稳定渲染，
// 且这四个入口是审计要求（必须存在、顺序固定），不能因为后台误删一条记录就变成空链接。
// 后台负责内容（标题 + 正文），前端负责入口与顺序；两者靠 page_key 对齐。
import type { InfoPageKey } from './types'
import type { MessageKey } from './i18n/messages'

/** 受支持的信息页标识集合（顺序用于路由解析，页脚展示顺序见 __root.tsx 的 FOOTER_LINKS）。 */
export const INFO_PAGE_KEYS: readonly InfoPageKey[] = [
  'operation',
  'personal-info',
  'terms',
  'data-usage',
] as const

/** page_key → 界面文案键。标题优先用后台 title，缺失时回退到这里。 */
export const INFO_PAGE_LABEL_KEY: Record<InfoPageKey, MessageKey> = {
  operation: 'infoOperation',
  'personal-info': 'infoPersonalInfo',
  terms: 'infoTerms',
  'data-usage': 'infoDataUsage',
}

/** 把任意路径段收窄为受支持的信息页标识；不支持则返回 null（路由据此 404）。 */
export function resolveInfoPageKey(raw: string | undefined): InfoPageKey | null {
  if (!raw) return null
  return (INFO_PAGE_KEYS as readonly string[]).includes(raw)
    ? (raw as InfoPageKey)
    : null
}
