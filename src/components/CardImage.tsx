'use client'

// 卡牌图片：列表 / 弹窗 / 图集共用。
//
// 统一三件事，避免每个渲染点各写一遍还不一致：
// - 加载占位：凹陷图位（bg-surface-2）上叠一层缓扫的亮带，图片字节到达前不再是一块死灰。
// - 加载淡入：图片 onLoad 后从 0→1 透明度淡入，叠在占位之上；占位与淡入都由本组件内部
//   状态驱动，调用方无需关心。
// - S3 约束：媒体走签名 302 下载，next/image 优化器会 400，所以一律原生 <img>
//   （与 CardCard / CardModal / CardGallery 既有的实现一致）。
//
// 组件只渲染「占位层 + <img>」这一对兄弟节点，外层那个带 aspect / rounded / overflow 的
// 盒由调用方提供（每个页面的盒还带各自的圆角、边框、视图转场名）。shimmer 用
// absolute inset-0 铺满盒子，<img> 用 h-full w-full 填满，二者都挂在调用方的
// relative 盒里。
import { useEffect, useRef, useState } from 'react'

export interface CardImageProps {
  src: string
  alt: string
  /** 作用在 <img> 上：object-cover / object-contain、hover 缩放等。 */
  imgClassName?: string
  width?: number | null
  height?: number | null
  loading?: 'lazy' | 'eager'
  fetchPriority?: 'high' | 'auto'
  decoding?: 'async' | 'sync' | 'auto'
  /** 换源时强制重挂（图集主图按 main.url 换，让加载占位重新播一次）。 */
  imgKey?: string
}

export function CardImage({
  src,
  alt,
  imgClassName,
  width,
  height,
  loading = 'lazy',
  fetchPriority = 'auto',
  decoding = 'async',
  imgKey,
}: CardImageProps) {
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLImageElement>(null)

  // 换源后先回到未加载态；缓存命中时 onLoad 可能在 React 挂上 handler 前就触发，
  // 挂载后就绪的图直接在 effect 里判定为已加载，避免卡在 opacity-0 看不见图。
  useEffect(() => {
    setLoaded(false)
    if (ref.current?.complete) setLoaded(true)
  }, [src, imgKey])

  return (
    <>
      {/* aria-hidden：纯装饰的加载占位，读屏不必读。 */}
      <div
        aria-hidden="true"
        className={`card-image-shimmer pointer-events-none absolute inset-0 transition-opacity duration-300 ease-out ${
          loaded ? 'opacity-0' : 'opacity-100'
        }`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={imgKey}
        ref={ref}
        src={src}
        alt={alt}
        width={width ?? undefined}
        height={height ?? undefined}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding={decoding}
        onLoad={() => setLoaded(true)}
        className={`h-full w-full transition-opacity duration-300 ease-out ${
          loaded ? 'opacity-100' : 'opacity-0'
        } ${imgClassName ?? ''}`}
      />
    </>
  )
}
