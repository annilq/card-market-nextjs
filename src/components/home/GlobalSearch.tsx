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
      // 手机端设计稿是 375 逻辑宽的 2x 出图（750px）：折半后输入框约 210×24、
      // 按钮约 45×24、图标字形 16px，所以 <md 用 h-6 + 11px 字 + 4px 圆角，
      // md 起恢复桌面尺寸。图标按钮外壳保持 24px（WCAG 2.5.8 最小点击区）。
      onSubmit={(e) => {
        e.preventDefault()
        const value = String(new FormData(e.currentTarget).get('q') ?? '')
        const q = value.trim()
        // 空关键词不写进 URL：`?q=` 与不带参数的结果一样，留着只会让分享链接更难读。
        router.push(localizeHref(q ? `/cards?q=${encodeURIComponent(q)}` : '/cards', locale))
      }}
      className="flex w-full items-center gap-1.5 md:gap-2.5"
    >
      <div className="relative min-w-0 flex-1">
        <input
          name="q"
          type="text"
          aria-label={t('searchPlaceholder')}
          placeholder=" "
          className="peer block h-6 w-full rounded border-0 bg-white px-2 text-[11px] text-slate-900 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:h-10 md:rounded-xl md:px-3.5 md:text-sm"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-2 right-2 hidden items-center truncate text-[11px] text-slate-600 peer-placeholder-shown:flex md:left-3.5 md:right-3.5 md:text-sm"
        >
          {/* 375 设计稿在手机上显示完整提示文案；只有比 370 更窄才退到短文案
              （11px 下完整文案约 182px，留出两侧 px-2 后 370 是刚好不截断的下限）。 */}
          <span className="min-[370px]:hidden">{t('searchPlaceholderShort')}</span>
          <span className="hidden min-[370px]:inline">{t('searchPlaceholder')}</span>
        </span>
      </div>
      <button
        type="submit"
        className="inline-flex cursor-pointer h-6 shrink-0 items-center gap-1 rounded bg-[radial-gradient(circle_at_0%_0%,#BCBCBC_0%,#FFFFFF_100%)] px-1.5 text-[11px] text-slate-700 transition hover:brightness-95 md:h-10 md:gap-1.5 md:rounded-[10px] md:px-4 md:text-sm"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          className="h-2.5 w-2.5 md:h-4 md:w-4"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        {t('search')}
      </button>
    </form>
  )
}
