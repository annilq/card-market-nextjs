'use client'

import Link from 'next/link'

import { localizeHref } from '@/lib/i18n/locales'
import { useLocale, useT } from '@/lib/i18n/client'

/**
 * `[locale]` 段的 404：未匹配路径与不支持的语言段都落到这里。
 *
 * 语言用 I18nProvider 里的那一个（根布局从请求头解析，已归一到受支持的值），
 * 不能用 URL 里的原始段——`/de/cards` 里那个段是非法值，
 * 直接拼链接会得到 `/de/cards` 这类二次 404。
 */
export default function LocaleRouteNotFound() {
  const locale = useLocale()
  const t = useT()

  return (
    <div className="py-24 text-center">
      <p className="text-6xl font-black tracking-tight text-faint" aria-hidden="true">
        404
      </p>
      <h1 className="mt-4 text-xl font-bold text-fg">{t('notFoundHeading')}</h1>
      <p className="mt-2 text-muted">{t('notFoundBody')}</p>
      <div className="mt-6 flex items-center justify-center gap-4 text-sm">
        <Link
          href={localizeHref('/', locale)}
          className="inline-flex items-center rounded-full bg-accent px-4 py-1.5 text-on-accent transition hover:bg-accent/90"
        >
          {t('backHome')}
        </Link>
        <Link href={localizeHref('/cards', locale)} className="text-muted underline">
          {t('browseCards')}
        </Link>
      </div>
    </div>
  )
}
