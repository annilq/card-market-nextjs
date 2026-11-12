'use client'

// 首页筛选面板（移植自 card-market 的 `FilterSheet`）。
//
// 与 /cards 那个 `FilterSheet` 是两种东西，不要合并：
//   - 这个是**单选**：点一项即生效、生效即关闭，面板底部没有「确定」；
//   - 那个是**多选**：分面勾完还要再点一次才收起面板。
// 首页是浅层浏览（tab 一按就换一批卡），/cards 是检索（要能叠加条件）。
//
// 外观按参考项目实测：整块品牌红底白字，右侧滑出、占 92vw（上限 520px）；
// 「分类」是二级——左竖 tab 选主系列（44%），右列选子系列，子系列第一项是「全部」，
// 用来「只要主系列、不要子系列」。

import { useRef, useState } from 'react'

import { useT } from '@/lib/i18n/client'
import { useDialog } from '@/lib/use-dialog'
import { DEFAULT_CARD_SORT, type CardSort, type FacetView } from '@/lib/types'

/** 面板当前开的是哪一个筛选。三个筛选共用同一个面板，只是内容不同。 */
export type HomeFilterField = 'series' | 'type' | 'sort'

export interface HomeFilterValue {
  cardStatusId: number | undefined
  seriesId: number | undefined
  sort: CardSort
  subSeriesId: number | undefined
}

export interface HomeFilterOption {
  /** 空串表示「全部」。 */
  label: string
  value: string
}

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

// 行高 48px：设计图实测行距 51px，48 仍在 WCAG 2.5.8 的 24px 之上且够手指点。
const row =
  'flex h-12 w-full items-center px-4 text-left text-base transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-white/70'

export function HomeFilterSheet({
  field,
  options,
  onClose,
  onPick,
  series,
  subSeries,
  title,
  value,
}: {
  field: HomeFilterField
  /** 主系列（调用方已按选中的 IP 收窄）。 */
  series: FacetView[]
  /** 全部子系列；面板内按当前主系列再过滤。 */
  subSeries: FacetView[]
  /** 面板标题（= 触发控件上的那个标签）。 */
  title: string
  value: HomeFilterValue
  /** 类型 / 排序的一级选项。分类不走这个字段。 */
  options: HomeFilterOption[]
  onPick: (next: Partial<HomeFilterValue>) => void
  onClose: () => void
}) {
  const t = useT()
  const panelRef = useRef<HTMLDivElement>(null)
  useDialog({ open: true, onClose, containerRef: panelRef })

  // 二级面板里当前看的是哪个主系列。它只是面板内的浏览位置，不写回 URL——
  // 真正生效是在右侧选中子系列（或「全部」）的那一刻。
  const [tabId, setTabId] = useState<number | undefined>(value.seriesId ?? series[0]?.id)

  const subs = tabId ? subSeries.filter((s) => s.parentId === tabId) : []

  const pickSeries = (subSeriesId: number | undefined) => {
    onPick({ seriesId: tabId, subSeriesId })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-999">
      {/* 遮罩：点它关闭。用 div + aria-hidden，因为它不是可聚焦控件，
          键盘用户走 Esc 或面板右上角那个关闭按钮。 */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="sheet-fade absolute inset-0 bg-black/45"
      />

      {/* 宽度：设计图的两列在日语下会挤成两行，桌面加宽到 520px；
          手机上仍给 92vw 的上限，避免在 375px 屏上溢出。 */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="sheet-in absolute inset-y-0 right-0 flex w-[min(560px,92vw)] flex-col bg-brand text-white outline-none"
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <span className="text-base font-bold">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('filterSheetClose')}
            className="inline-flex h-9 w-9 items-center justify-center rounded text-white transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <CloseIcon />
          </button>
        </div>

        {field === 'series' ? (
          series.length === 0 ? (
            // 该 IP 下还没有主系列。给一句话而不是两列空栏：空的两列会被读成
            // 「加载中」或「点不动」，说清楚是没数据。
            <div className="min-h-0 flex-1 p-4 text-sm text-white">{t('noCategories')}</div>
          ) : (
            // 二级：左竖 tab 选主系列，右列选子系列。两列各自滚动——
            // 主系列或子系列都可能很长，整体滚动会把另一列顶出视野。
            <div className="flex min-h-0 flex-1">
              {/* 主系列给 44%：日语系列名常常一屏两行，窄列会挤成竖排；
                  子系列多是短名，让出宽度反而更好扫。 */}
              <div className="w-[46%] shrink-0 overflow-y-auto bg-black/15">
                {series.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setTabId(s.id)}
                    aria-current={s.id === tabId}
                    className={`${row} px-3 text-xl ${
                      s.id === tabId ? 'bg-black/15 font-bold' : 'font-medium text-white'
                    }`}
                  >
                    <span className="line-clamp-2">{s.name}</span>
                  </button>
                ))}
              </div>
              <div className="min-w-0 flex-1 overflow-y-auto">
                {/* 「全部」置顶：只选主系列、不选任何子系列时用这一项。 */}
                <button
                  type="button"
                  onClick={() => pickSeries(undefined)}
                  className={`${row} ${
                    tabId === value.seriesId && value.subSeriesId == null
                      ? 'bg-white/20 font-bold'
                      : 'font-medium'
                  }`}
                >
                  <span className="truncate">{t('facetAll')}</span>
                </button>
                {subs.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pickSeries(s.id)}
                    className={`${row} ${
                      s.id === value.subSeriesId ? 'bg-white/20 font-bold' : 'font-medium'
                    }`}
                  >
                    <span className="truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        ) : (
          // 一级：类型与排序没有第二层，直接一列。
          <div className="min-h-0 flex-1 overflow-y-auto">
            {options.map((o) => (
              <button
                key={o.value || '__all'}
                type="button"
                onClick={() => {
                  if (field === 'type') {
                    onPick({ cardStatusId: o.value ? Number(o.value) : undefined })
                  } else {
                    onPick({ sort: (o.value || DEFAULT_CARD_SORT) as CardSort })
                  }
                  onClose()
                }}
                className={`${row} ${
                  (field === 'type' ? o.value === String(value.cardStatusId ?? '') : o.value === value.sort)
                    ? 'bg-white/20 font-bold'
                    : 'font-medium'
                }`}
              >
                <span className="truncate">{o.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
