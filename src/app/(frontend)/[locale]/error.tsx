'use client'

import Link from 'next/link'

import { localizeHref } from '@/lib/i18n/locales'
import { useLocale, useT } from '@/lib/i18n/client'

/**
 * `[locale]` 段的渲染异常兜底，避免整页白屏。
 *
 * 它已经位于根布局之内（顶栏 / 页脚 / I18nProvider 都在外面），
 * 所以这里只给 main 里的内容，不重复渲染页眉页脚。
 */
export default function LocaleRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const locale = useLocale()
  const t = useT()
  // digest 是服务端日志里的追踪串；production 下 React 不保证给出 message，
  // 两个都没有时至少让页面读得出来「出了错」。
  const detail = typeof error?.message === 'string' && error.message ? error.message : error?.digest

  return (
    <div className="py-24 text-center">
      {/* 数字用弱化档：500 应当读得到，但不必和正文抢注意力。 */}
      <div className="text-6xl font-black tracking-tight text-faint">500</div>
      <p className="mt-4 text-muted">{t('errorBody')}</p>
      {detail && <p className="mx-auto mt-2 max-w-xl break-all text-xs text-faint">{detail}</p>}
      <div className="mt-6 flex items-center justify-center gap-4 text-sm">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-full bg-accent px-4 py-1.5 text-on-accent transition hover:bg-accent/90"
        >
          {t('reload')}
        </button>
        <Link href={localizeHref('/', locale)} className="text-muted underline">
          {t('backHome')}
        </Link>
      </div>
    </div>
  )
}
