import { headers } from 'next/headers'

/**
 * 站点绝对域名 —— 全站唯一真源（single source of truth）。
 *
 * 设计原则：**线上不依赖任何「站点域名」变量**。
 * - 线上（Vercel 注入 VERCEL=1，或运行在 serverless 里）：`serverURL` 留空，
 *   Payload 改用相对路径 / 请求 host（同源）。本文件的前台 canonical / OG 也走「请求 host」，
 *   于是无论访问主域名、部署专属域名还是 preview，URL 都自动同向，永远不会出现 localhost。
 * - 本地 dev：回退 `localhost:3100`，保证本地 SSR 的媒体绝对地址正确。
 *
 * 兜底链（仅本地 dev 会用到）：
 *   SITE_URL（普通服务端变量）|| NEXT_PUBLIC_SITE_URL（本地 .env 在用它）|| http://localhost:3100
 *
 * 为什么不用 `NEXT_PUBLIC_`：Vercel 现在不允许新建 NEXT_PUBLIC_ 前缀变量，所以线上靠「请求 host」，
 * 而不是靠注入的域名变量。这也绕开了「填错部署域名导致后台跨域空白」那一整类问题（见 docs/04-deploy-vercel.md 坑 7）。
 */
const FALLBACK_SITE_URL =
  process.env.SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3100'

/** 去掉末尾斜杠，如 `https://x.vercel.app/` → `https://x.vercel.app` */
export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

/** 本地 dev 的兜底域名（线上用不到，因为走请求 host / 相对路径）。 */
export const LOCAL_SITE_URL = stripTrailingSlash(FALLBACK_SITE_URL)

/**
 * 取「请求实际到达的 origin」。
 * 在 server 组件 / generateMetadata 里调用：读 `x-forwarded-host` / `host`，
 * 让 canonical / OG 永远指向用户真实访问的域名（同源），不依赖任何配置变量。
 * 拿不到（非请求上下文）时回退到本地兜底。
 */
export async function getOrigin(): Promise<string> {
  try {
    const h = await headers()
    const host = h.get('x-forwarded-host') || h.get('host')
    if (host) {
      const proto = h.get('x-forwarded-proto') || 'https'
      return stripTrailingSlash(`${proto}://${host}`)
    }
  } catch {
    // 非请求上下文（极少数情况）：回退本地兜底。
  }
  return LOCAL_SITE_URL
}

/**
 * 拼绝对 URL（带前导斜杠的路径 → 完整地址），host 取请求 host。
 * 例：`absUrl('/cards', 'zh')` → `https://<用户访问域名>/zh/cards`
 */
export async function absUrl(path = '', locale = ''): Promise<string> {
  const origin = await getOrigin()
  const withLocale = locale
    ? `/${locale}${path.startsWith('/') ? path : `/${path}`}`
    : path
  const cleanPath = stripTrailingSlash(withLocale) || '/'
  return `${origin}${cleanPath}`
}
