import Link from 'next/link'

import { localizeHref } from '@/lib/i18n/locales'
import { getTranslator } from '@/lib/i18n/t'
import type { MessageKey } from '@/lib/i18n/messages'
import { getLocaleFromHeaders } from '@/lib/i18n/server'
import type { SiteSettingsView } from '@/lib/data'

/**
 * 帮助中心的链接与顺序（照参考项目固定，与后台数据解耦）：
 * 运营信息 → 个人信息收集 → 数据使用 → 留言咨询 → 利用规则。
 *
 * 留言咨询夹在中间而不是另起一行：它与四个合规页同属「帮助中心」，
 * 参考项目把它们排在同一组栅格里（留言是第 4 格）。
 * 之前本站把它和「卡牌 / 公告 / 门店」并成第二组，页脚因此出现两块链接区，
 * 与参考项目「一块 logo + 一块帮助中心」的结构不一致。
 */
const FOOTER_LINKS: readonly { path: string; key: MessageKey }[] = [
  { path: '/info/operation', key: 'infoOperation' },
  { path: '/info/personal-info', key: 'infoPersonalInfo' },
  { path: '/info/data-usage', key: 'infoDataUsage' },
  { path: '/message', key: 'navContact' },
  { path: '/info/terms', key: 'infoTerms' },
]

const footerLinkClass =
  'inline-flex items-center py-1.5 text-sm text-footer-muted transition hover:text-footer-fg hover:underline'

/** 站点页脚（服务端组件）。结构照参考项目：左 logo + 右「帮助中心」一组链接 + 底部版权。 */
export async function SiteFooter({ settings }: { settings: SiteSettingsView }) {
  const locale = await getLocaleFromHeaders()
  const t = getTranslator(locale)
  const siteName = settings.siteName?.trim() || t('defaultSiteName')

  return (
    <footer className="mt-16 bg-footer text-footer-fg">
      {/* 参考图的页脚：近黑底、左侧 logo、右侧「帮助中心」标题 + 链接栅格，
          底部一行居中的版权。链接栅格 2 列起、sm 起 3 列：手机上三列会把
          「个人信息收集」挤成两行。每格 py-1.5 把点击高度抬到 28px（WCAG 2.5.8 要 24px）。 */}
      <div className="mx-auto flex max-w-[1232px] flex-col gap-12 px-4 pt-20 md:flex-row md:items-start md:justify-between md:gap-16">
        <div className="shrink-0">
          {/* 后台没传 logo 就退回站点名文字，不留空白图位：一张占位图对访客
              来说和「图片挂了」没有区别。 */}
          {settings.logo?.url ? (
            <div className="flex items-center justify-center">
              <img
                src={settings.logo.url}
                alt={settings.logo.alt ?? siteName}
                width={settings.logo.width ?? undefined}
                height={settings.logo.height ?? undefined}
                className="h-16 w-auto max-w-[240px] object-contain"
                loading="lazy"
              />
            </div>
          ) : (
            <span className="text-2xl font-bold">{siteName}</span>
          )}
        </div>

        {/* 右侧块固定 665px 并靠右：参考图里「帮助中心」那一块就是从容器右端
            往左量 665px。用 flex-1 会随视口变宽而左移，标题就对不上参考图的位置。 */}
        <div className="min-w-0 md:w-[665px] md:max-w-full">
          <h2 className="text-xl font-bold md:text-2xl">{t('footerHelpCenter')}</h2>

          <nav
            aria-label={t('footerNavTitle')}
            className="mt-4 grid grid-cols-2 gap-x-10 gap-y-1 sm:grid-cols-3 sm:gap-x-12"
          >
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.path}
                href={localizeHref(link.path, locale)}
                className={footerLinkClass}
              >
                {t(link.key)}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <p className="mt-12 pb-12 text-center text-sm text-footer-fg">
        {t('copyright', { year: new Date().getFullYear() })}
      </p>
    </footer>
  )
}
