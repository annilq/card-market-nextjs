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
 * 直接输出 `data-theme="light"`，不会被系统深色偏好带跑。
 *
 * 用户一旦在「账号」里手动选过主题，Payload 会改写（或删除）这个 cookie；
 * 用 init 标记「已经种过一次」，避免与「跟随系统」反复打架。
 *
 * 默认从深色改为浅色：init 标记升到 v2。老访客身上由 v1 种下的
 * `payload-theme=dark` 会被一次性改写成 light；手动选过深色的用户也会被
 * 重置一次（顶栏切换按钮可再切回），换取「所有人默认浅色」的一致性。
 */
const ADMIN_THEME_COOKIE = 'payload-theme'
const ADMIN_THEME_INIT_COOKIE = 'payload-theme-init-v2'
const LEGACY_ADMIN_THEME_INIT_COOKIE = 'payload-theme-init'
const LEGACY_DEFAULT_ADMIN_THEME = 'dark'
const DEFAULT_ADMIN_THEME = 'light'

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    // 后台界面语言：默认中文，但仍允许在「账户 → 设置」里手动切到日/英。
    //
    // Payload 的 getRequestLanguage（payload/dist/utilities/getRequestLanguage.js）按
    //   payload-lng cookie > Accept-Language > fallbackLanguage
    // 逐级挑选，且 supportedLanguages 里有 ja / en。所以日文 / 英文系统的浏览器
    // 会把后台整页渲染成日语 / 英语，中文系统则是中文——客户反馈的「有时候日语、
    // 有时候中文」就是这么来的：语言是按请求、按浏览器决定的，跟账号无关，
    // 登录接口也不会写入任何语言设置（只发 payload-token）。
    //
    // 这里把后台请求的 Accept-Language 归一成 zh，首屏直接是中文，不会闪一帧日文；
    // 由于 cookie 优先级高于请求头，用户手动选过语言时 payload-lng 仍然生效。
    // 同时也消除了 CDN 按 Accept-Language 缓存出不同语言页面的隐患。
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('Accept-Language', 'zh-CN,zh;q=0.9')
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    if (!request.cookies.get(ADMIN_THEME_INIT_COOKIE)) {
      const currentTheme = request.cookies.get(ADMIN_THEME_COOKIE)?.value
      const legacyInit = request.cookies.get(LEGACY_ADMIN_THEME_INIT_COOKIE)
      // 新访客：种下浅色。
      // v1 老访客仍带着当年种下的深色默认值：一次性改成浅色（手动选过深色的
      // 用户也会被重置一次，顶栏切换按钮可再切回）。
      // v1 老访客但 theme cookie 不在了 = 选过「跟随系统」，不打扰他。
      if ((!legacyInit && !currentTheme) || (legacyInit && currentTheme === LEGACY_DEFAULT_ADMIN_THEME)) {
        response.cookies.set(ADMIN_THEME_COOKIE, DEFAULT_ADMIN_THEME, {
          maxAge: 60 * 60 * 24 * 365,
          path: '/',
          sameSite: 'lax',
        })
      }
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
