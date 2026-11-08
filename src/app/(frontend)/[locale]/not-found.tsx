'use client'

/**
 * `[locale]` 段的 404：段内 notFound()（例如 `/de/cards` 里语言段非法时页面主动抛出）
 * 会落到这里，而不是内置 404。
 *
 * 未匹配路径由 `[locale]/[...rest]/page.tsx` 的 catch-all 主动 notFound() 导到这里，
 * 段内页面自己的 notFound() 也落到这里——两种来路共用同一套 NotFoundView。
 * 语言由 NotFoundView 内部从 I18nProvider 取（URL 首段解析，非法段回退 zh），
 * 不能直接用 URL 里的原始段——`/de/cards` 里那个段是非法值，拼链接会二次 404。
 */
import { NotFoundView } from '@/components/layout/NotFoundView'

export default function LocaleRouteNotFound() {
  return <NotFoundView />
}
