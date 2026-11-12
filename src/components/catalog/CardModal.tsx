'use client'

// 卡牌弹窗：点首页卡片列表里的卡片就地弹出，不跳转。
//
// 版式来自实测（446×297）：白卡片弹窗，左图与右信息列各占 47%，
// 信息列与详情页共用 `CardInfo`，因此弹窗里不需要第二套事实面板。
//
// 关不掉的入口等于坏了，所以三条退路都在这里：Esc、点遮罩、点右上角。
// 另外补了两条题目要求的：焦点陷阱（Tab 不会掉到身后的页面上）与
// 「咨询此卡」直达留言页——弹窗里展示的正是想问的那张卡，不该让人再去搜一次。
//
// 移植到 Next 的三处改动：
// - 卡牌数据已经是 `CardView`（列表请求里带齐了 / 弹窗不必再取一次），
//   语言段由 `locale` 道具显式传入（服务端渲染的那棵树不能假设客户端 context）；
// - 站内链接用 `next/link` + `localizeHref`；
// - 浮层行为（Esc / 锁滚动 / 焦点陷阱 / 焦点归还）改用公共的 `useDialog`（`src/lib/use-dialog.ts`）。

import { useRef } from 'react'
import Link from 'next/link'

import { CardInfo } from './CardInfo'
import { useDialog } from '@/lib/use-dialog'
import { useT } from '@/lib/i18n/client'
import { localizeHref, type Locale } from '@/lib/i18n/locales'
import type { CardView } from '@/lib/types'
import { CardImage } from '@/components/CardImage'

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
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

export function CardModal({
  card,
  locale,
  onClose,
}: {
  card: CardView
  locale: Locale
  onClose: () => void
}) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  // 弹窗只在父级判定为打开时才挂载，故 open 恒为 true。
  useDialog({ open: true, onClose, containerRef: ref })
  const img = card.images[0]
  const src = img?.cardUrl || img?.url
  // 「高价买取 / 不减额买取」压在图角（与列表卡、横条卡一致），
  // 信息列里不再重复一颗，因此下面给 CardInfo 传 showBuyback={false}。
  const buybackLabel = card.isHighValue ? t('highValue') : card.isNoDeduction ? t('noDeduction') : null

  return (
    <div className="fixed inset-0 z-999 flex items-center justify-center p-4">
      {/* 遮罩：点它关闭。它是 div + aria-hidden 而不是按钮——
          键盘用户走 Esc 或右上角那颗关闭按钮。 */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="sheet-fade absolute inset-0 bg-black/45"
      />

      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={card.name}
        tabIndex={-1}
        // max-w 取 560：实测是 446，正文行更长、且要给关闭按钮留位。
        // 最高 90dvh 且内部滚动：矮屏（横屏手机）上信息列比弹窗还高时仍能关掉。
        className="modal-in relative flex max-h-[90dvh] w-full max-w-[560px] gap-5 overflow-y-auto rounded-xl bg-surface p-5 outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('closeCard')}
          className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
        >
          <CloseIcon />
        </button>

        <div className="w-[47%] shrink-0">
          <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-surface-2">
            {src ? (
              // 加载占位 + 淡入由 CardImage 统一处理（媒体走 S3 签名 302，用原生 <img>）。
              <CardImage
                src={src}
                alt={img?.alt || card.name}
                imgClassName="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-hint">
                {t('noImageShort')}
              </div>
            )}
            {buybackLabel && (
              // 压在图左上角：与列表卡同一颗标、同一位置；图位的圆角会裁掉
              // 左上角，因此用全圆角胶囊、不额外加边。
              <span className="absolute left-0 top-0 z-10 flex h-7.5 items-center rounded-full bg-brand px-2.5 text-xs font-semibold text-white">
                {buybackLabel}
              </span>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <CardInfo
            card={card}
            locale={locale}
            showBuyback={false}
            actions={
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {/* 咨询此卡：把卡牌 id 带进留言页的卡牌上下文（`?card=<id>`）。 */}
                <Link
                  href={localizeHref(`/message?card=${card.id}`, locale)}
                  className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
                >
                  {t('inquireCard')}
                </Link>
                {/* 弹窗里仍留一条通往完整详情页的路：详情页有图集与描述，
                    也是可以分享、可以被引擎收录的那个地址。 */}
                <Link
                  href={localizeHref(`/cards/${card.id}`, locale)}
                  className="inline-flex items-center text-sm text-muted transition-colors duration-150 hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
                >
                  {t('cardDetailLink')} →
                </Link>
              </div>
            }
          />
        </div>
      </div>
    </div>
  )
}
