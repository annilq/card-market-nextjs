import { NextResponse, type NextRequest } from 'next/server'

import { LOCALES } from '@/lib/i18n/locales'

/**
 * 界面语言是 URL 的可选第一段：默认语言 zh 不带前缀（`/cards`），其余语言带（`/ja/cards`）。
 * 这里做两件事：
 *   1. 把不带前缀的请求 rewrite 到 `/zh/...`（Next 的动态段 `[locale]` 始终存在）；
 *   2. 把解析出的语言写进 `x-locale` 请求头——根布局拿不到 `[locale]` 参数，
 *      靠它才能正确输出 `<html lang>`。
 * 形如 `/de/cards` 的两字母未知语言段不做 rewrite，交给 `[locale]` 路由返回 404。
 */
const LANGUAGE_SEGMENT = /^[a-z]{2}$/

/**
 * 后台默认主题。Payload 的 ThemeProvider 只在 `admin.theme === 'all'` 时读这个
 * cookie（见 @payloadcms/next 的 getRequestTheme），种下它就能让服务端首屏
 * 直接输出 `data-theme="dark"`，不必先闪一帧浅色。
 *
 * 用户一旦在「账号」里手动选过主题，Payload 会改写（或删除）这个 cookie；
 * 用 `payload-theme-init` 标记「已经种过一次」，避免与「跟随系统」反复打架。
 */
const ADMIN_THEME_COOKIE = 'payload-theme'
const ADMIN_THEME_INIT_COOKIE = 'payload-theme-init'
const DEFAULT_ADMIN_THEME = 'dark'

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const response = NextResponse.next()
    if (!request.cookies.get(ADMIN_THEME_COOKIE) && !request.cookies.get(ADMIN_THEME_INIT_COOKIE)) {
      response.cookies.set(ADMIN_THEME_COOKIE, DEFAULT_ADMIN_THEME, {
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
        sameSite: 'lax',
      })
      response.cookies.set(ADMIN_THEME_INIT_COOKIE, '1', {
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
        sameSite: 'lax',
      })
    }
    return response
  }

  const first = pathname.split('/')[1] ?? ''

  const locale = first in LOCALES ? first : 'zh'
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-locale', locale)

  // 静态资源（public/ 下的 png、ico、txt 等）不做语言 rewrite：
  // 否则 /high_price.png 会被改写成 /zh/high_price.png 然后 404。
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  if (first === '' || !LANGUAGE_SEGMENT.test(first)) {
    const suffix = pathname === '/' ? '' : pathname
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}${suffix}`
    url.search = search
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/((?!_next/static|_next/image|admin|api|media|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
