'use client'

// 全站搜索框（首页 hero）。从 TanStack Start 版移植，版式与「为什么这样排」的判断原样保留：
// - 提示文案盖在输入框上而不是用 placeholder 属性：属性值固定、没法按宽度换，
//   完整文案实测 247px 宽，窄屏必然被裁成「罕见…」，所以窄屏用短文案、xl 起用完整文案。
// - 输入框用一个空格占位，`:placeholder-shown` 才能判断「是否为空」。
//
// 两处按 Next 改：
// - 提交改用 `useRouter().push`（源站是 router.navigate），目标地址补语言段；
// - 不再从 URL 读 q 回填：源站的读法是为了「顶栏在 /cards?q=… 上也要显示当前词」，
//   Next 版这个组件只出现在首页，读 URL 会额外引入 useSearchParams + Suspense 边界。

import { useRouter } from 'next/navigation'

import { useLocale, useT } from '@/lib/i18n/client'
import { localizeHref } from '@/lib/i18n/locales'

export function GlobalSearch() {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()

  return (
    <form
      // 参考图顶栏：560×40 白输入框 + 80×40 浅灰「检索」按钮，两者分开，各带 4px 圆角。
      onSubmit={(e) => {
        e.preventDefault()
        const value = String(new FormData(e.currentTarget).get('q') ?? '')
        const q = value.trim()
        // 空关键词不写进 URL：`?q=` 与不带参数的结果一样，留着只会让分享链接更难读。
        router.push(localizeHref(q ? `/cards?q=${encodeURIComponent(q)}` : '/cards', locale))
      }}
      className="flex w-full items-center gap-2.5"
    >
      <div className="relative min-w-0 flex-1">
        <input
          name="q"
          type="text"
          aria-label={t('searchPlaceholder')}
          placeholder=" "
          className="peer h-10 w-full rounded-xl border-0 bg-white px-3.5 text-sm text-fg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3.5 right-3.5 hidden items-center truncate text-sm text-subtle peer-placeholder-shown:flex"
        >
          <span className="xl:hidden">{t('searchPlaceholderShort')}</span>
          <span className="hidden xl:inline">{t('searchPlaceholder')}</span>
        </span>
      </div>
      <button
        type="submit"
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-surface-2 px-4 text-sm text-fg transition hover:bg-border-strong"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        {t('search')}
      </button>
    </form>
  )
}
