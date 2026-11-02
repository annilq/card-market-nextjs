'use client'

// 手机上承载筛选的底部面板。
//
// 桌面用常驻侧栏（见 CatalogFilters），手机上把同一块筛选内容塞进底部面板：
// 侧栏在 375px 上会占掉整屏，而把筛选折叠成一颗按钮 + 一层面板，
// 首屏就能直接看到卡牌。面板里就是侧栏那一份内容，不是另一套筛选。
//
// 面板只负责「装起来 + 关掉」，值仍然由调用方（URL）持有。
import { useRef, type ReactNode } from 'react'

import { useDialog } from '@/lib/use-dialog'
import { useT } from '@/lib/i18n/client'

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function FilterSheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const t = useT()
  const panelRef = useRef<HTMLDivElement>(null)
  // 面板只在父级判定为打开时才挂载（`{filtersOpen && <FilterSheet/>}`），故 open 恒为 true。
  // trapFocus: false 是这处浮层原有的行为（它移植时就没有焦点陷阱），纯重构不改。
  useDialog({ open: true, onClose, containerRef: panelRef, trapFocus: false })

  return (
    <div className="fixed inset-0 z-999 lg:hidden">
      {/* 面板是向上滑入的；globals.css 里只有向右滑的 `.sheet-in`（那是首页筛选面板），
          而它不属于本次要改的文件，所以这条 keyframes 就近声明在组件里。
          遮罩沿用现成的 `.sheet-fade`。 */}
      <style>{`
@keyframes sheet-up { from { transform: translateY(100%); } to { transform: none; } }
.sheet-up { animation: sheet-up var(--dur-state) var(--ease-out-soft) both; }
@media (prefers-reduced-motion: reduce) {
  .sheet-up { animation: none; opacity: 1; transform: none; }
}
`}</style>

      {/* 遮罩：点它关闭。用 div + aria-hidden，因为它不是可聚焦控件，
          键盘用户走 Esc 或面板右上角那个关闭按钮。 */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="sheet-fade absolute inset-0 bg-black/45"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        // 最高 85dvh：面板内部自己滚动，标题行与关闭按钮始终留在视野里。
        className="sheet-up absolute inset-x-0 bottom-0 flex max-h-[85dvh] min-h-0 flex-col rounded-t-2xl bg-surface text-fg outline-none"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <span className="text-base font-bold">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('filterSheetClose')}
            className="inline-flex h-9 w-9 items-center justify-center rounded text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}
