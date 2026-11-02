'use client'

// 门店列表及其联动的地图。
//
// 「选中哪家」是这一页唯一的状态，而且它同时决定左侧大图、右侧信息块和地图的中心，
// 因此状态放在这里（列表 + 详情共用的最小外壳），地图只是它的一个消费者。
// 数据（ShopView[]）由服务端 page 传来：`getShops()` 已经按访问过滤（草稿/未发布不可见），
// 这里不再过滤一次，避免两套过滤规则不一致。
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { MapView } from '@/components/shops/MapView'
import { useLocale, useT } from '@/lib/i18n/client'
import { localizeHref } from '@/lib/i18n/locales'
import type { ShopView } from '@/lib/types'

// 门店行：切换当前门店用。选中态是左侧 2px 品牌红签名条 + 浅表面，
// 不是阴影——系统是「静止时无阴影」（Flat-At-Rest），阴影在这里只是第二重提示。
// 签名条常驻 2px、只换颜色：宽度若从 0 长出来，整行文字会左右跳。
function ShopRow({
  shop,
  active,
  onClick,
}: {
  shop: ShopView
  active: boolean
  onClick: () => void
}) {
  // 缩略图位只有 96×72：取后台预生成的 480×480 thumb（Directus 版本是现场裁 240×180 webp），
  // 拿不到缩略图就退回原图，不为此换一套版面。
  const img = shop.image?.thumbUrl || shop.image?.url || null
  const t = useT()
  const label = [
    shop.name,
    shop.address,
    shop.phone ? t('phoneLabel', { phone: shop.phone }) : '',
    shop.businessHours ? t('hoursLabel', { hours: shop.businessHours }) : '',
  ]
    .filter(Boolean)
    .join('，')

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label || shop.name}
      className={`group relative flex w-full gap-3 rounded-xl border bg-surface p-3 text-left transition-colors duration-150 ${
        active ? 'border-brand bg-surface-2' : 'border-border hover:border-border-strong'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-3 left-0 w-0.5 rounded-full transition-colors duration-150 ${
          active ? 'bg-brand' : 'bg-transparent'
        }`}
      />
      <div className="h-[72px] w-24 shrink-0 overflow-hidden rounded-lg bg-surface-2">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={shop.image?.alt || shop.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-hint text-xs">
            {t('noImageShort')}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="break-words font-medium text-fg">{shop.name}</div>
        {shop.address && <div className="mt-0.5 truncate text-xs text-muted">{shop.address}</div>}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
          {shop.phone && (
            <span className="tabular-nums">{t('phoneLabel', { phone: shop.phone })}</span>
          )}
          {shop.businessHours && (
            <span className="tabular-nums">{t('hoursLabel', { hours: shop.businessHours })}</span>
          )}
        </div>
      </div>
    </button>
  )
}

function PinIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 shrink-0"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  )
}

function ShopInfo({ shop }: { shop: ShopView }) {
  const t = useT()
  return (
    <div>
      <div className="break-words text-xl font-bold md:text-2xl">{shop.name}</div>
      {shop.address && (
        <div className="mt-3 flex gap-2 text-sm text-muted">
          <PinIcon />
          <span className="min-w-0 break-words">{shop.address}</span>
        </div>
      )}
      {shop.businessHours && (
        <div className="mt-2 text-sm tabular-nums text-muted">
          {t('hoursLabel', { hours: shop.businessHours })}
        </div>
      )}
      {shop.phone && (
        <div className="mt-1 text-sm tabular-nums text-muted">
          {t('phoneLabel', { phone: shop.phone })}
        </div>
      )}
    </div>
  )
}

function ShopMap({
  shop,
  selectedId,
  onSelect,
}: {
  shop: ShopView
  selectedId: number
  onSelect: (id: number) => void
}) {
  const t = useT()
  // MapView 按 id 集合判断是否需要重建地图，数组身份每次渲染都变会让第二个
  // useEffect 反复 setView；这里按 shop 缓存住，只在真的换了门店时换数组。
  const shops = useMemo(() => [shop], [shop])
  return (
    <div
      role="region"
      aria-label={shop.name}
      className="aspect-[540/318] overflow-hidden rounded-xl border border-border bg-surface-2"
    >
      {/* MapView 自己撑满容器，因此高度由这个外壳的宽高比给。 */}
      <MapView shops={shops} selectedId={selectedId} onSelect={onSelect} />
      <span className="sr-only">{t('shopsIntro')}</span>
    </div>
  )
}

export function ShopList({ shops }: { shops: ShopView[] }) {
  const t = useT()
  const locale = useLocale()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  // 大图块始终有内容：没选就展示第一家，否则首屏是一块空图位。
  const current = shops.find((s) => s.id === selectedId) ?? shops[0]
  // 主图 960×598（≈1.6:1）：用后台预生成的 banner 幅（1920×900），
  // 没有就退回原图——原图可能很大，但门店图位是这一页的主视觉，不能留空。
  const heroImg = current?.image ? current.image.bannerUrl || current.image.url || null : null

  const leaveMessageLink = (
    <Link
      href={localizeHref('/message', locale)}
      className="inline-flex min-h-11 items-center rounded-lg bg-brand px-5 py-2.5 text-sm text-white transition-colors duration-150 hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
    >
      {t('leaveMessage')}
    </Link>
  )

  if (!current) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-faint">{t('noShops')}</p>
        <div className="mt-4">{leaveMessageLink}</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/*<h1 className="break-words text-[28px] font-bold leading-snug">{t('shopsTitle')}</h1>*/}

      {/* 双列：左门店图（带营业时间覆层）+ 右「店名 / 地址 / 电话 / 地图」。
          比例来自设计图实测：左图 960×598，右块 540 宽，中间空 61px，
          地图 540×318。列宽用 minmax(0,…)：grid 子项默认 min-width:auto，
          会被长地址的 min-content 顶宽，320 视口下整页横向溢出。
          后台没传照片时左列仍然是图位（放「暂无图片」占位），
          版面不因此换成另一种结构——左图、右信息+地图是这一页的固定骨架。 */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.78fr)_minmax(0,1fr)]">
        <div className="relative aspect-[960/598] overflow-hidden rounded-xl bg-surface-2">
          {heroImg ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImg}
                alt={current.image?.alt || current.name}
                className="h-full w-full object-cover"
              />
              {/* 覆层压在图底部：设计图的营业时间就是压在门店照片上的白字。
                  用底部实心、向上渐隐的黑色，避免浅色照片上文字掉到 1:1 级别。
                  没有照片时不压字：信息块里已经有一份营业时间，不必重复。 */}
              {(current.businessHours || current.phone) && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent p-5 text-white sm:p-6">
                  {current.businessHours && (
                    <>
                      <div className="text-xs font-medium text-white/85">{t('businessHours')}</div>
                      <div className="mt-1 text-lg font-bold tabular-nums">
                        {current.businessHours}
                      </div>
                    </>
                  )}
                  {current.phone && (
                    <div className="mt-2 text-sm tabular-nums text-white/90">
                      {t('phoneLabel', { phone: current.phone })}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-hint text-sm">
              {t('noImage')}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-7 justify-center">
          <ShopInfo shop={current} />
          <ShopMap shop={current} selectedId={current.id} onSelect={setSelectedId} />
        </div>
      </div>

      {/* 多店切换：只有一家门店时这一整块不出现，不为「只有一个选项」留一排。 */}
      {shops.length > 1 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-fg">{t('allShops')}</h2>
          <div className="space-y-3">
            {shops.map((s) => (
              <ShopRow
                key={s.id}
                shop={s}
                active={s.id === current.id}
                onClick={() => setSelectedId(s.id)}
              />
            ))}
          </div>
        </div>
      )}

      <div>{leaveMessageLink}</div>
    </div>
  )
}
