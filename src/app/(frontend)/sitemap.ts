import type { MetadataRoute } from 'next'

import { getOrigin } from '@/lib/site-url'
import { LOCALES } from '@/lib/i18n/locales'

// 站点地图：每个静态路由按语言生成一条，SEO 覆盖全语言入口。
// 动态内容（卡牌 / 公告 / 门店）数量大且频繁变动，不在这里枚举——交给各页自身的
// canonical / hreflang 处理索引，sitemap 只保「入口级」页面。
const STATIC_PATHS = ['', '/cards', '/announcements', '/shops', '/message']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await getOrigin()
  const now = new Date()
  const entries: MetadataRoute.Sitemap = []
  for (const locale of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
    for (const path of STATIC_PATHS) {
      const url = locale === 'zh' ? `${origin}${path}` : `${origin}/${locale}${path}`
      entries.push({ url, lastModified: now, changeFrequency: 'weekly', priority: path === '' ? 1 : 0.8 })
    }
  }
  return entries
}
