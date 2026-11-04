'use client'

// 首页「点了就地弹窗」的卡片网格。
//
// 为什么单独一个客户端组件：弹窗要记住「当前点开的是哪一张」，那是客户端状态；
// 而卡片本身是服务端渲染好的（`getCards` 的结果作为参数传进来），
// 不能为了弹一颗窗把整份列表下沉到浏览器里再取一次。
//
// 由此分工：`CardCard` 仍是带 href 的真实链接，只在普通左键时把导航换成弹窗
// （修饰键 / 中键照旧开新标签，见 CardCard 的 onClick）。
// 列表数据已经带齐了弹窗要显示的字段，所以打开弹窗不需要再发一次请求。

import { useState } from 'react'

import { CardCard } from '@/components/CardCard'
import { CardModal } from '@/components/catalog/CardModal'
import type { Locale } from '@/lib/i18n/locales'
import type { CardView } from '@/lib/types'

export function HomeCardGrid({ cards, locale }: { cards: CardView[]; locale: Locale }) {
  const [open, setOpen] = useState<CardView | null>(null)

  return (
    <>
      {/* 网格列数与列数断点同 /cards 与源站（2 / 3 / 4 / 5）。 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {cards.map((c, i) => (
          // 首屏第一行的卡片（最多 5 列）设 priority，让 next/image 直接预加载、优化 LCP。
          <CardCard key={c.id} card={c} locale={locale} onOpen={setOpen} priority={i < 5} />
        ))}
      </div>

      {open && <CardModal card={open} locale={locale} onClose={() => setOpen(null)} />}
    </>
  )
}
