// 卡牌信息块：徽章 + 「名称 / 编号 / 状态」三行 + 价格。
//
// 版式来自附件实测（446×297）：左图与右信息列各占 47%；信息列顶部一颗红底徽章，
// 下面三行「标签：值」（实测 名称 / 编号 / 罕见度），价格压在列底、品牌红、约 24px。
//
// 第三行放的是「卡牌状态」而不是附件里的「罕见度」：罕见度被提到了顶部那颗
// 红底徽章上（附件顶部的 PSA10 也是这个位置、这个颜色），我们没有独立的评级字段，
// 再把罕见度在下面写一遍就成了同一信息两处——这条判断在移植时走过一次弯路
// （曾经既有徽章又有一行「稀有程度」），现已回到源码的处理。
//
// IP / 系列 / 子系列同理不进这张表：它们在信息卡上方那行小字里出现过，
// 上架时间与描述在下面第二张卡里。这一块因此保持三行——行数越少，
// 价格离卡名越近，而这一页要卖的就是「哪个卡、多少钱」。
import type { ReactNode } from 'react'

import { formatYen } from '@/lib/format'
import type { Locale } from '@/lib/i18n/locales'
import { getTranslator } from '@/lib/i18n/t'
import type { CardView } from '@/lib/types'

export function CardInfo({
  card,
  locale,
  nameAs = 'div',
  actions,
}: {
  card: CardView
  locale: Locale
  /** 详情页需要一个标题级元素（SEO 与读屏都靠它），弹窗里则不该有 h1。 */
  nameAs?: 'div' | 'h1'
  /**
   * 价格正下方的动作区（详情页的「咨询此卡」）。
   * 插在描述之前：价格与「问这张卡」是同一件事的两面，中间不该隔一段正文。
   */
  actions?: ReactNode
}) {
  const t = getTranslator(locale)
  const accent = card.cardStatusAccent
  const statusLabel = card.cardStatusName
  const buybackLabel = card.isHighValue ? t('highValue') : card.isNoDeduction ? t('noDeduction') : null
  const nameClass = 'min-w-0 break-words font-medium text-fg'
  const valueClass = 'min-w-0 break-words text-fg'

  return (
    <div className="flex min-w-0 flex-col">
      {(card.rarityName || card.isHighValue || card.isNoDeduction || accent) && (
        <div className="flex flex-wrap items-center gap-2">
          {card.rarityName && (
            // 红底：实测徽章底色 #db261d，与顶栏同一支红。
            // 这一颗徽章是罕见度在详情页的唯一去处，表格里不再重复。
            <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">
              {card.rarityName}
            </span>
          )}
          {buybackLabel && (
            <span className="rounded-full bg-brand px-2.5 py-1 text-xs text-white">
              {buybackLabel}
            </span>
          )}
          {accent && card.cardStatusName && (
            <span className="rounded-full bg-vault-bg px-2.5 py-1 text-xs text-vault">
              {card.cardStatusName}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 space-y-1.5 text-sm">
        <InfoRow label={t('cardNameLabel')}>
          {nameAs === 'h1' ? (
            <h1 className={nameClass}>{card.name}</h1>
          ) : (
            <div className={nameClass}>{card.name}</div>
          )}
        </InfoRow>
        {card.code && (
          <InfoRow label={t('cardCodeLabel')}>
            {/* 编号走 tabular-nums：卡牌编号是数字串，列宽不齐会读错一位。 */}
            <span className="min-w-0 break-words tabular-nums text-fg">{card.code}</span>
          </InfoRow>
        )}
        <InfoRow label={t('cardStatus')}>
          <span className={valueClass}>{statusLabel ?? '—'}</span>
        </InfoRow>
      </div>

      {/* mt-auto：被拉高的容器里（弹窗）价格落到列底（附件实测价格在底部）。
          详情页这一列不拉伸，这里没有多余高度可占，价格就紧跟在三行下面。 */}
      <div className="mt-auto pt-4 text-2xl font-bold tabular-nums text-price">
        {card.price != null
          ? t('priceTag', { price: formatYen(card.price) })
          : t('priceOnRequest')}
      </div>

      {actions}
    </div>
  )
}

// 标签与值同一行，用全角冒号分隔（附件就是「名称：マリオピカチュウ」这种写法）。
function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-1">
      <span className="shrink-0 text-faint">{label}：</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  )
}
