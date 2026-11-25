import { en } from './messages/en'
import { ja, type AdminMessageKey } from './messages/ja'
import { zh } from './messages/zh'

export type { AdminMessageKey }

export type AdminLanguage = 'en' | 'ja' | 'zh'

export type AdminVariables = Record<string, number | string>

export type AdminT = (key: AdminMessageKey, variables?: AdminVariables) => string

const MESSAGES: Record<AdminLanguage, Record<AdminMessageKey, string>> = { en, ja, zh }

/**
 * 后台界面语言。Payload 交回来的 language 可能是 `ja` / `ja-JP` / `zh-CN`，
 * 这里统一收成三档；认不出来时按后台默认语言（日语）处理。
 */
export function resolveAdminLanguage(input?: null | string): AdminLanguage {
  const tag = (input ?? '').toLowerCase()
  if (tag.startsWith('ja')) return 'ja'
  if (tag.startsWith('en')) return 'en'
  if (tag.startsWith('zh')) return 'zh'
  return 'ja'
}

/** 服务端组件与纯函数用这个；客户端组件用 useAdminT()（同一份字典）。 */
export function createAdminT(language?: null | string): AdminT {
  const table = MESSAGES[resolveAdminLanguage(language)]
  return (key, variables) => {
    let text: string = table[key] ?? ja[key] ?? key
    if (variables) {
      for (const [name, value] of Object.entries(variables)) {
        text = text.replaceAll(`{${name}}`, String(value))
      }
    }
    return text
  }
}

/** Intl / 日期格式化用的 BCP 47 标签。 */
export function adminDateLocale(language?: null | string): string {
  switch (resolveAdminLanguage(language)) {
    case 'ja':
      return 'ja-JP'
    case 'zh':
      return 'zh-CN'
    case 'en':
      return 'en-US'
  }
}
