'use client'

import { useTranslation } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

import { createAdminT, type AdminMessageKey } from '@/lib/admin/i18n'

/** 自定义视图的标签页标题。Payload 的 meta.title 是静态字符串，拿不到请求语言。 */
const TITLES: Record<string, AdminMessageKey> = {
  '/admin': 'dashboard.overview',
  '/admin/bulk-cards': 'nav.bulkCards',
  '/admin/help': 'help.pageTitle',
  '/admin/no-deduction-buyback': 'nav.noDeduction',
}

/**
 * 自定义视图（仪表盘 / 帮助 / 批量上架 / 不减额买取）的文档标题按语言改写。
 *
 * Payload 在路由层用 config 里的 meta.title 生成 <title>，那份值是静态字符串，
 * 没有按请求语言求值的入口。页内正文已经由各自的组件按 i18n.language 渲染，
 * 这里补上标签页 / 历史记录里那一行。其它路由不碰，交给 Payload 自己的本地化。
 */
export function AdminTitleLocalizer() {
  const { i18n } = useTranslation()
  const pathname = usePathname()

  useEffect(() => {
    const key = pathname ? TITLES[pathname.replace(/\/$/, '')] : undefined
    if (!key) return
    const t = createAdminT(i18n.language)
    const desired = `${t(key)} | ${t('meta.titleSuffix')}`
    const apply = () => {
      if (document.title !== desired) document.title = desired
    }
    apply()
    // Next 的服务端 metadata 会在 hydration 后再写一次 <title>，把这里的结果盖掉；
    // 盯着 head，被改写就再写回来。值相同则不动，不会自激。
    const observer = new MutationObserver(apply)
    observer.observe(document.head, { characterData: true, childList: true, subtree: true })
    return () => observer.disconnect()
  }, [i18n.language, pathname])

  return null
}
