import Link from 'next/link'

import { GlobalSearch } from '@/components/home/GlobalSearch'
import { localizeHref } from '@/lib/i18n/locales'
import { getLocaleFromHeaders } from '@/lib/i18n/server'
import { getTranslator } from '@/lib/i18n/t'
import type { SiteSettingsView } from '@/lib/data'

import { LocaleSwitcher } from './LocaleSwitcher'
import { ThemeToggle } from './ThemeToggle'

// X（原 Twitter）图标：官方简化字形，实心路径。
// 旁边的汉字标签与它在视觉重量上更配，因此这里不用描边风格。
function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

// 店铺图标：源站同一张 shop.png（public/ 已随静态资源迁入）。
function ShopIcon() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/shop.png" alt="" loading="lazy" aria-hidden="true" />
}

// 顶栏图标按钮共用同一套外壳尺寸，保证右侧一组在所有宽度下等高。
const iconBtn =
  'inline-flex h-9 shrink-0 items-center justify-center rounded text-white/90 transition hover:bg-white/15 hover:text-white'
const iconBtnSquare = `${iconBtn} w-9`

/**
 * 站点顶栏（服务端组件）。
 *
 * 结构对齐源站 __root.tsx（实测版式）：
 *   ≥1024：logo + 全局搜索(flex-1) + [X + 店铺信息(带文字)] + [语言 + 主题]；
 *   <1024：第一行 logo + [语言 + 主题]，第二行搜索 + X + 店铺图标。
 * 「卡牌 / 公告」不放文字导航——源站刻意把主视线让给搜索（见源站注释），
 * 它们走折叠菜单与首页内容区；页脚「站内链接」兜底全站可达。
 *
 * 语言从请求头取（`x-locale`，由 middleware 写入）：根布局已经保证整棵树
 * 在「同一种语言」下渲染。所有站内链接先按「无语言前缀」的形态书写，
 * 再用 localizeHref 补前缀——默认语言（zh）拿到的就是原路径，ja / en 才带段。
 */
export async function SiteHeader({ settings }: { settings: SiteSettingsView }) {
  const locale = await getLocaleFromHeaders()
  const t = getTranslator(locale)
  const siteName = settings.siteName?.trim() || t('defaultSiteName')

  // 折叠菜单：源站的移动菜单只放 卡牌 / 公告，店铺有图标入口、留言在页脚；
  // 这里四个都放——移动端没有首页大卡片可点，少了这两项会不可达。
  const menu = [
    { href: '/cards', label: t('navCards') },
    { href: '/announcements', label: t('navAnnouncements') },
    { href: '/shops', label: t('navShops') },
    { href: '/message', label: t('navContact') },
  ]

  // X 账号只在后台维护（形如 @cardmarket），没配就整颗图标不渲染，不留死链。
  const xHandle = settings.xAccount?.replace(/^@/, '').trim()
  const xUrl = xHandle ? `https://x.com/${xHandle}` : null

  const xLink = xUrl ? (
    <a
      href={xUrl}
      target="_blank"
      rel="me noreferrer"
      aria-label={t('xAccountLabel')}
      className={iconBtnSquare}
    >
      <XIcon />
    </a>
  ) : null

  return (
    <header className="sticky top-0 z-99 bg-brand text-white">
      <div className="mx-auto max-w-[1200px] px-4">
        <div className="flex h-12 items-center gap-3 md:h-24 md:gap-6 text-lg">
          <Link
            href={localizeHref('/', locale)}
            aria-label={siteName}
            className="flex min-w-0 shrink-0 items-center truncate"
          >
            {/* 后台设了站点 logo 就优先用图，没设才回落到站点名文字。 */}
            {settings.logo?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logo.url}
                alt={settings.logo.alt ?? siteName}
                className="h-7 w-auto object-contain md:h-[57px]"
              />
            ) : (
              <span className="truncate font-bold text-white md:text-2xl">{siteName}</span>
            )}
          </Link>

          {/* 搜索框：≥1024 与 logo 同一行（参考图就是「logo + 白输入框 + 图标组」三件套），
              剩余空间**全**给搜索、不设上限——参考项目实测搜索框一直排到图标组左边，
              本站之前那道 560px 上限会在 1200px 容器里留下一段空白；<1024 下移到第二行。
              GlobalSearch 是客户端组件：它要把输入推到 `/cards?q=…`。 */}
          <div className="hidden min-w-0 flex-1 lg:flex">
            <GlobalSearch />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-4">
            {/* ≥1024：X 与 店铺信息 和搜索同组（源站同构）。
                店铺文字只在 ≥lg 出现；再窄退化成方形图标、移到第二行。 */}
            <div className="hidden items-center gap-2 lg:flex">
              {xLink}
              <Link
                href={localizeHref('/shops', locale)}
                aria-label={t('shopLabel')}
                className={`${iconBtnSquare} lg:w-auto lg:gap-1.5 lg:px-2.5`}
              >
                <ShopIcon />
                <span className="hidden text-2xl font-semibold tracking-wide lg:inline">
                  {t('shopLabel')}
                </span>
              </Link>
            </div>
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>

        {/* <1024：搜索 + X + 店铺图标作为一组放在第二行（源站同构），整行宽度让给搜索。 */}
        <div className="flex items-center gap-1.5 py-2 lg:hidden">
          <div className="flex min-w-0 flex-1">
            <GlobalSearch />
          </div>
          {xLink}
          <Link href={localizeHref('/shops', locale)} aria-label={t('shopLabel')} className={iconBtnSquare}>
            <ShopIcon />
          </Link>
        </div>
      </div>

      {/* <1024：原生 `<details>` 折叠菜单。
          源站的移动菜单是个 client 组件（menuOpen state，触发按钮已在改版中移除，
          实际不可达）；本站保留一个可用的入口：同样键盘可达（summary 可聚焦、
          回车展开），且在水合之前就能用。代价是点链接后不会自动收起——
          需要时换成 `src/components/layout/MobileMenu.tsx`（client 组件）即可。 */}
      <details className="border-t border-white/25 bg-brand lg:hidden">
        <summary
          className="flex h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm text-white/90 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white [&::-webkit-details-marker]:hidden"
          aria-label={t('openMenu')}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="shrink-0"
            aria-hidden="true"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {t('openMenu')}
        </summary>
        <nav className="flex flex-col px-4 pb-3" aria-label={siteName}>
          {menu.map((item) => (
            <Link
              key={item.href}
              href={localizeHref(item.href, locale)}
              className="border-b border-white/25 py-2.5 text-sm text-white/85 transition hover:text-white last:border-0"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </details>
    </header>
  )
}
