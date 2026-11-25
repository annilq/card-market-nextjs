'use client'

import { useTranslation } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

/**
 * 登录页的界面语言切换。
 *
 * 后台界面语言由 Payload 决定（payload-lng cookie > Accept-Language > 兜底）。
 * 未登录时 Payload 没有入口能写这个 cookie，所以借 TranslationProvider 的
 * switchLanguage。它调用 Payload 自己的服务端 action 写 cookie，再 router.refresh。
 * 语言清单只读 languageOptions，本地不再抄一份，否则配置一改两边就会不一致。
 *
 * ja 的 thisLanguage 标签是英文「Japanese」，所以紧凑标签按语言码查表，
 * 未知语言码才退回 Payload 给的 label。
 */

const COMPACT_LABELS: Record<string, string> = {
  en: 'EN',
  ja: '日',
  zh: '中',
}

// router.refresh 不返回 promise，等不到它完成，所以按钮的禁用时长以
// 「界面语言真的变了」为准；超时兜底，避免请求失败或点的是当前语言时卡死。
const PENDING_TIMEOUT_MS = 5000

export function AdminLanguageSwitcher() {
  const { i18n, languageOptions, switchLanguage } = useTranslation()
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    if (pending === null) return
    if (i18n.language === pending) {
      setPending(null)
      return
    }
    const timer = window.setTimeout(() => setPending(null), PENDING_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [pending, i18n.language])

  if (!languageOptions?.length || !switchLanguage) return null

  const select = (lang: Parameters<NonNullable<typeof switchLanguage>>[0]) => {
    if (pending !== null) return
    setPending(lang)
    void switchLanguage(lang)
  }

  return (
    <div className="admin-lang-switch" role="group" aria-label={i18n.t('general:language')}>
      {languageOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          className="admin-lang-switch__option"
          aria-pressed={option.value === i18n.language}
          disabled={pending !== null}
          onClick={() => select(option.value)}
        >
          {COMPACT_LABELS[option.value] ?? option.label}
        </button>
      ))}
    </div>
  )
}
