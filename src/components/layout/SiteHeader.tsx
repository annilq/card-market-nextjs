import Link from "next/link";

import { GlobalSearch } from "@/components/home/GlobalSearch";
import { localizeHref } from "@/lib/i18n/locales";
import { getLocaleFromHeaders } from "@/lib/i18n/server";
import { getTranslator } from "@/lib/i18n/t";
import type { SiteSettingsView } from "@/lib/data";

import { LocaleSwitcher } from "./LocaleSwitcher";
import { ThemeToggle } from "./ThemeToggle";

// X（原 Twitter）图标：改用源站同一张 x.png（public/ 已随静态资源迁入），
// 与 shop.png 同为 27px 高的白色图标，在品牌色顶栏上视觉重量一致。
function XIcon() {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/x.png"
      alt=""
      width={30}
      height={27}
      loading="lazy"
      aria-hidden="true"
      className="w-auto"
    />
  );
}

// 店铺图标：源站同一张 shop.png（public/ 已随静态资源迁入）。
function ShopIcon() {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/shop.png"
      alt=""
      width={29}
      height={27}
      loading="lazy"
      aria-hidden="true"
      className="h-7 w-auto"
    />
  );
}

// 顶栏图标按钮共用同一套外壳尺寸，保证右侧一组在所有宽度下等高。
const iconBtn =
  "inline-flex h-9 shrink-0 items-center justify-center rounded text-white transition hover:bg-white/15 hover:text-white";
const iconBtnSquare = `${iconBtn} w-9`;

/**
 * 站点顶栏（服务端组件）。
 *
 * 结构对齐参考项目 card-market 的 __root.tsx：
 *   顶行 logo + 全局搜索(flex-1) + [X + 店铺信息] + [语言 + 主题]；
 *   其中 [语言 + 主题] 在 <2xl 时留在内容列右端（与 X·店铺同行、靠 ml-auto 推到行尾，
 *   不会重叠），≥2xl 才脱离文档流、钉到视口右缘——普通笔记本宽度下 1200 列几乎占满视口，
 *   没有空间容纳边缘按钮，回退行内右端才能避免与 X·店铺重叠；
 *   <1024：搜索 + X + 店铺图标移到第二行（顶行只留 logo + 语言 + 主题）。
 * 「卡牌 / 公告」不放文字导航——参考项目刻意把主视线让给搜索，device 模式下
 * 也去掉了移动菜单；它们走首页内容区，页脚「站内链接」兜底全站可达。
 *
 * 语言从请求头取（`x-locale`，由 middleware 写入）：根布局已经保证整棵树
 * 在「同一种语言」下渲染。所有站内链接先按「无语言前缀」的形态书写，
 * 再用 localizeHref 补前缀——默认语言（zh）拿到的就是原路径，ja / en 才带段。
 */
export async function SiteHeader({ settings }: { settings: SiteSettingsView }) {
  const locale = await getLocaleFromHeaders();
  const t = getTranslator(locale);
  const siteName = settings.siteName?.trim() || t("defaultSiteName");

  // 移动菜单：参考项目 card-market 在改版里已经把移动菜单的触发按钮移除、
  // 实际不可达——也就是「device 模式下去掉了导航」。本站对齐参考，不再单独放
  // 折叠菜单：移动端走首页「全部 →」链接 / 全局搜索进 /cards，店铺靠图标入口、
  // 留言在页脚，与参考项目一致。

  // X 账号只在后台维护（形如 @koduckya），没配就整颗图标不渲染，不留死链。
  const xHandle = settings.xAccount?.replace(/^@/, "").trim();
  const xUrl = xHandle ? `https://x.com/${xHandle}` : null;

  const xLink = xUrl ? (
    <a
      href={xUrl}
      target="_blank"
      rel="me noreferrer"
      aria-label={t("xAccountLabel")}
      className={iconBtnSquare}
    >
      <XIcon />
    </a>
  ) : null;

  return (
    <header className="md:sticky top-0 z-99 bg-brand text-white">
      <div className="mx-auto max-w-[1200px] px-4">
        {/* 顶行：语言 + 主题切换不再绝对定位贴视口边缘（那样在 1201–1535px 区间会
            压到同处右上角的 X·店铺图标），改为行内右端、≥2xl 才绝对定位。这里无需
            再为它预留 padding。 */}
        <div className="flex h-16 items-center gap-3 max-md:gap-2 md:h-24 md:gap-6 text-lg">
          <Link
            href={localizeHref("/", locale)}
            aria-label={siteName}
            // 顶栏 logo：最高频的返回首页入口，进视口即预取整条路由（见优化项 ②）。
            prefetch
            className="flex min-w-0 shrink-0 items-center truncate"
          >
            <img
              src={settings?.logo?.url||`/logo_header.png`}
              alt={settings?.logo?.alt ?? siteName}
              width={settings?.logo?.width ?? 300}
              height={settings?.logo?.height ?? 57}
              className=" w-auto object-contain"
            />
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
                店铺文字只在 ≥lg 出现；再窄退化成方形图标、移到第二行。
                语言切换与主题切换与 X·店铺同行显示（窄屏行内右端、
                ≥2xl 才钉视口右缘）。 */}
            <div className="hidden items-center gap-2 lg:flex">
              {xLink}
              <Link
                href={localizeHref("/shops", locale)}
                aria-label={t("shopLabel")}
                // 店铺入口：进视口即预取（见优化项 ②）。
                prefetch
                className={`${iconBtnSquare} lg:w-auto lg:gap-1.5 lg:px-2.5`}
              >
                <ShopIcon />
                <span className="hidden text-2xl font-semibold tracking-wide lg:inline">
                  {t("shopLabel")}
                </span>
              </Link>
            </div>

            {/* 辅助功能控件：语言切换 + 主题切换。窄屏（<2xl）留在内容列右端、
                 与 X·店铺同行（靠外层 ml-auto 推到行尾，不重叠）；≥2xl 才脱离文档流、
                 钉到视口右缘。这修掉了「缩小窗口时国际化按钮压住店铺信息」——
                 之前恒为绝对定位贴视口右上角 + ≤1200 预留 pr-[168px]，
                 致 1201–1535px 区间工具条压到同处右上角的 X·店铺。 */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-4 2xl:absolute 2xl:right-4 2xl:top-0 2xl:h-24">
              <LocaleSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* <1024：搜索 + X + 店铺图标作为一组放在第二行（源站同构），整行宽度让给搜索。 */}
        <div className="flex items-center gap-1.5 py-2 lg:hidden">
          <div className="flex min-w-0 flex-1">
            <GlobalSearch />
          </div>
          {xLink}
          <Link
            href={localizeHref("/shops", locale)}
            aria-label={t("shopLabel")}
            prefetch
            className={iconBtnSquare}
          >
            <ShopIcon />
          </Link>
        </div>
      </div>
    </header>
  );
}
