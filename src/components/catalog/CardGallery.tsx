'use client'

// 卡牌图集：缩略图条 + 主图，带左右方向键切换。
//
// 从 TanStack 版移植时只搬了「图集这段交互」：那边首页点卡片是弹窗（CardModal），
// 弹窗壳在这里不需要——Next 版直接导航到真实详情页，图集只服务这一页。
// 所有文案由服务端算好传进来（`galleryLabel` / 逐条的 `galleryThumb`）：
// 客户端组件因此不必再拿语言上下文，也不依赖 Provider 是否包住这一层。

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'

import type { ImageView } from '@/lib/types'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { CardImage } from '@/components/CardImage'

export interface CardGalleryProps {
  images: ImageView[]
  /** 主图 alt：整块图讲的就是这张卡，所以直接用卡名。缩略图是装饰（按钮自带 aria-label）。 */
  alt: string
  /** `galleryLabel`：图集整体的可聚焦说明（原文就写明了「可用左右方向键切换」）。 */
  galleryLabel: string
  /** `galleryThumb` 按索引预先翻译好：函数不能跨服务端/客户端边界传。 */
  thumbLabels: string[]
  /** 一张图都没有时的占位文案（`noImage`）。 */
  emptyLabel: string
  /** view-transition-name：与列表页缩略图共用同一个名字，跨页形变靠它对上。 */
  vtName?: string
}

/** 缩略图用 Payload 生成的小尺寸，主图用原图：一次只下载当前视口需要的那一份。 */
const thumbSrc = (image: ImageView): string => image.thumbUrl || image.cardUrl || image.url

export function CardGallery({
  images,
  alt,
  galleryLabel,
  thumbLabels,
  emptyLabel,
  vtName,
}: CardGalleryProps) {
  const [active, setActive] = useState(0)
  // 主图淡入只在「用户换了一张」之后播。首帧不播：页面加载时大图淡入
  // 是加载编排，不是状态变化；而且转场（view transition）本来就会把这张图
  // 从列表带过来，两者叠在一起会看见两次动。
  const [swapped, setSwapped] = useState(false)

  const thumbsRef = useRef<Array<HTMLButtonElement | null>>([])
  const reducedMotion = useReducedMotion()

  const count = images.length
  // 图片数组由服务端给出，索引始终有效；这里再夹一次，避免列表与图集不同步时空白。
  const index = count ? Math.min(active, count - 1) : 0
  const main = count ? images[index] : null
  const hasMany = count > 1

  const select = (i: number) => {
    setSwapped(true)
    setActive(i)
  }

  // 换图后把当前缩略图带进可视区：缩略图条是横向滚动的，图一多（或键盘连按方向键）
  // 选中的那张会滚出条外——主图换了、底下的高亮却看不见，等于没有反馈。
  // 只在用户换过之后跑（首帧不滚）：加载时的自动滚动会被读成页面自己在动。
  useEffect(() => {
    if (!swapped || !hasMany) return
    thumbsRef.current[index]?.scrollIntoView({
      // block/inline 都取 nearest：只在条内做最小滚动，不牵动整页。
      block: 'nearest',
      inline: 'nearest',
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }, [index, hasMany, swapped, reducedMotion])

  // 方向键在缩略图之间移动：只在真的有多张图时接管，
  // 且不拦截输入框（这一页没有，但保留判断以免将来加字段时出问题）。
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!hasMany) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      select((index - 1 + count) % count)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      select((index + 1) % count)
    }
  }

  return (
    <div className="min-w-0">
      <div
        // 共享元素：从列表点进来时，这张图的图位与列表缩略图是同一个
        // `view-transition-name`（按卡牌 id 生成），浏览器会把缩略图
        // 形变成大图——这是全站唯一的作者时刻，它解释「你点的就是这一张」。
        // 聚焦环走系统令牌（墨色 2px + 2px offset），不是浏览器默认的蓝框：
        // 这一块是全站唯一「可聚焦的图片组」，默认环在这里会像一处漏样式。
        // max-w-[60vh] + aspect-[3/4] 把高度锁在 80vh 以内：宽屏下图片列会
        // 随视口变宽、按 3:4 无限长高，这里给一个上限，避免一张图顶到屏幕外。
        // max-h-[80vh] 是冗余兜底；mx-auto 让图片在过宽的列里居中。
        className="vt-card relative mx-auto aspect-[3/4] max-h-[80vh] w-full max-w-[60vh] overflow-hidden rounded-xl border border-border bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
        style={{ '--vt-name': vtName } as CSSProperties}
        onKeyDown={onKeyDown}
        tabIndex={hasMany ? 0 : undefined}
        role={hasMany ? 'group' : undefined}
        aria-label={hasMany ? galleryLabel : undefined}
      >
        {main ? (
          // key 换掉时淡入：同一张图位换源，不做淡入会「啪」地跳一下。
          // 用 opacity 而非 transform，避免和 view transition 的形变打架。
          // 主图必须是原图（`url`）而不是 `cardUrl`：Payload 的 card 尺寸是
          // 800×800 居中裁切，object-contain 的图位里会把卡面裁掉一圈。
          // width/height 带上媒体尺寸：图位本身是 aspect-[3/4]，但这两个属性
          // 让浏览器在图片字节到达前就算出占位，加载完成不会再顶一下。
          // 加载占位 + 淡入由 CardImage 统一处理（媒体走 S3 签名 302，用原生 <img>）。
          <CardImage
            key={main.url}
            src={main.url}
            // 优先用后台给这张图填的 alt（多图时每张说的可能不是同一面），
            // 没填才退回卡名——整块图讲的就是这张卡。
            alt={main.alt || alt}
            width={main.width ?? undefined}
            height={main.height ?? undefined}
            decoding="async"
            // 主图就是这一页的 LCP 元素，别让它排在缩略图后面取。
            fetchPriority="high"
            imgKey={main.url}
            imgClassName={`object-contain ${swapped ? 'banner-enter' : ''}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-hint">
            {emptyLabel}
          </div>
        )}
      </div>

      {hasMany && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((image, i) => (
            <button
              key={`${image.url}-${i}`}
              ref={(node) => {
                thumbsRef.current[i] = node
              }}
              type="button"
              onClick={() => select(i)}
              aria-label={thumbLabels[i]}
              aria-current={i === index ? 'true' : undefined}
              // h-20 / w-16（80×64）：比 24px 最小点击目标宽裕，手指也点得中。
              className={`relative h-20 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted ${
                i === index
                  ? 'border-fg'
                  : 'border-transparent hover:border-border-strong'
              }`}
            >
              {/* 缩略图的文字信息由按钮的 aria-label 承担，图片本身是装饰。
                  加载占位 + 淡入由 CardImage 统一处理（媒体走 S3 签名 302，用原生 <img>）。 */}
              <CardImage
                src={thumbSrc(image)}
                alt=""
                width={image.width ?? undefined}
                height={image.height ?? undefined}
                loading="lazy"
                decoding="async"
                imgClassName="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
