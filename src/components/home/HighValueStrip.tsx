// 首页高价买取横条（从 TanStack Start 版移植）。单行横向滚动，不换行、无箭头。
//
// 三处细节是「横条」这个形态特有的，网格里不需要：
//
// 1. **右缘渐隐。** 横条默认裁在最后一张卡的中间，看起来像布局出错。
//    右缘一层 `mask-image` 渐隐告诉人「还能往右」，且不需要画箭头。
// 2. **吸附滚动。** 手机上用手指甩时，卡片停在卡位边界而不是任意偏移。
// 3. **卡位略宽。** 原来 144px（`w-36`）在 3:4 图位里只有 108px 高的图，
//    卡名与价格挤成两行小字；改成 160px 后价格不再截断。

import Link from 'next/link'

import { CardCard } from '@/components/CardCard'
import { getTranslator } from '@/lib/i18n/t'
import type { Locale } from '@/lib/i18n/locales'
import { localizeHref } from '@/lib/i18n/locales'
import type { CardView } from '@/lib/types'

export function HighValueStrip({
  items,
  locale,
}: {
  items: CardView[]
  locale: Locale
}) {
  const t = getTranslator(locale)

  return (
    <section>
      {/* 区块标题：参考图里这一块是居中的品牌红图形标题，因此标题居中、
          用品牌红而不是墨黑；「全部」压在右端（绝对定位）才能保住居中。
          图形标题 high_price.png 已随静态资源迁到 public/，与源站同一张图。 */}
      <div className="relative mb-4 flex items-center justify-center">
        <img
          src="/high_price.png"
          alt={t('highValueBuys')}
          width={205}
          height={86}
          className="h-10 w-auto md:h-20"
        />
        <Link
          href={localizeHref('/cards?hv=1', locale)}
          className="absolute right-0 inline-flex items-center py-1 text-xs text-muted transition-colors duration-150 hover:text-fg hover:underline"
        >
          {t('viewAll')}
        </Link>
      </div>
      {/* 可聚焦的滚动区域：键盘用户需先聚焦容器才能用方向键横向滚动。 */}
      <div
        role="region"
        aria-label={t('highValueBuys')}
        tabIndex={0}
        className="strip-fade flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-xl pb-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong"
      >
        {items.map((c) => (
          // 卡位 224px：参考图的横条是 5 张 ≈227px 卡位铺满整行。
          <div key={c.id} className="w-44 shrink-0 snap-start sm:w-56">
            <CardCard card={c} locale={locale} compact />
          </div>
        ))}
      </div>
    </section>
  )
}
