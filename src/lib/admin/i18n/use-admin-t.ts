'use client'

import { useTranslation } from '@payloadcms/ui'

import { createAdminT, type AdminT } from './index'

/**
 * 客户端组件拿后台自有文案的入口。语言来自 Payload 的 TranslationProvider，
 * 与顶栏 / 登录页的语言切换共用同一个 `i18n.language`，切完立刻生效。
 */
export function useAdminT(): AdminT {
  const { i18n } = useTranslation()
  return createAdminT(i18n.language)
}
