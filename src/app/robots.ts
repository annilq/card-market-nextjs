import type { MetadataRoute } from 'next'

import { getOrigin } from '@/lib/site-url'

// robots.txt：允许全站抓取，只排除后台与 API。
// 站点域名走「请求 host」（见 src/lib/site-url），部署到哪个域名都自动同向。
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await getOrigin()
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api'],
    },
    sitemap: `${origin}/sitemap.xml`,
  }
}
