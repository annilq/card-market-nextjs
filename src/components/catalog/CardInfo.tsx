// 卡牌信息块：状态徽章 + 「名称 / 编号 / 罕见度」三行 + 价格。
//
// 版式来自附件实测（446×297）：左图与右信息列各占 47%；信息列顶部一颗卡牌状态
// 徽章（PSA10 / 裸卡 / BOX，配色与列表卡一致），下面三行「标签：值」，
// 价格压在列底、右对齐、品牌红、约 24px。
//
// 状态与罕见度是两件事：PSA10 / 裸卡是「卡牌状态」，UR 是「罕见度」。
// 状态占顶部徽章（后台可增删的自由文本，配色走 `statusBadgeClass`），
// 罕见度回到表格第三行——不再把罕见度做成徽章、把状态写成一行。
//
// 「高价买取 / 不减额买取」标签不属于信息列：它压在图角上（与列表卡一致），
// 由调用方（`CardModal` / 详情页图集）负责；`showBuyback` 只给仍需要文字标签的
// 场景兜底，两者同时出现就会把同一颗标显示两遍。
//
// IP / 系列 / 子系列同理不进这张表：它们在信息卡上方那行小字里出现过，
// 上架时间与描述在下面第二张卡里。这一块因此保持三行——行数越少，
// 价格离卡名越近，而这一页要卖的就是「哪个卡、多少钱」。
import type { ReactNode } from 'react'

import { statusBadgeClass } from '@/lib/card-status'
import { formatYen } from '@/lib/format'
import type { Locale } from '@/lib/i18n/locales'
import { getTranslator } from '@/lib/i18n/t'
import type { CardView } from '@/lib/types'

export function CardInfo({
  card,
  locale,
  nameAs = 'div',
  actions,
  showBuyback = true,
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
  /** 图角已经压了「高价买取」标时传 false，避免信息列里再出现一颗。 */
  showBuyback?: boolean
}) {
  const t = getTranslator(locale)
  const statusLabel = card.cardStatusName?.trim() || null
  const buybackLabel = showBuyback
    ? card.isHighValue
      ? t('highValue')
      : card.isNoDeduction
        ? t('noDeduction')
        : null
    : null
  const nameClass = 'min-w-0 break-words font-medium text-fg'

  return (
    <div className="flex h-full min-w-0 flex-col">
      {(statusLabel || buybackLabel) && (
        <div className="flex flex-wrap items-center gap-2">
          {statusLabel && (
            // 状态徽章配色与列表卡同一套：PSA10 红、裸卡蓝、BOX 绿，
            // 认不出来的状态回到品牌红。
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold text-white ${statusBadgeClass(statusLabel)}`}
            >
              {statusLabel}
            </span>
          )}
          {buybackLabel && (
            <span className="rounded-full bg-brand px-2.5 py-1 text-xs text-white">
              {buybackLabel}
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
        <InfoRow label={t('rarityLabel')}>
          <span className="min-w-0 break-words text-fg">{card.rarityName ?? '—'}</span>
        </InfoRow>
      </div>

      {/* mt-auto：被拉高的容器里（弹窗）价格落到列底；text-right 让它贴右下角
          （附件实测价格在卡片右下）。详情页这一列不拉伸，价格紧跟三行、同样右对齐。 */}
      <div className="mt-auto pt-4 text-right text-2xl font-bold tabular-nums text-price">
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
