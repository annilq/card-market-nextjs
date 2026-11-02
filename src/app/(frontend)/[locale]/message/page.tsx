// 访客留言页：/message（zh）/ /ja/message。
//
// 表单本身是客户端组件（src/components/MessageForm.tsx），这里只做两件事：
// 判定语言段、把 `?card=<id>` 解析成卡牌上下文。
// 只放 id：卡名/价格在这里现取，避免 URL 里出现可被篡改、且会过期的旧价格。
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { MessageForm } from '@/components/MessageForm'
import { getCard } from '@/lib/data'
import { LOCALES, type Locale } from '@/lib/i18n/locales'
import { getTranslator } from '@/lib/i18n/t'
import type { CardView } from '@/lib/types'

// 搜索参数（`?card=`）逐请求变化，且表单要读到最新的卡牌数据。
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ locale: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

/** `?card=12` → 12；非正整数 / 缺失一律当「没有卡牌上下文」。 */
function parseCardId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return null
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

async function loadCard(id: number): Promise<CardView | null> {
  try {
    return await getCard(id)
  } catch (error) {
    // 卡牌已下架 / 后台不可达：留言页照常可用，只是没有卡牌上下文。
    console.error('[message] card load failed', id, error)
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale } = await params
  if (!(rawLocale in LOCALES)) return {}
  const t = getTranslator(rawLocale as Locale)
  return {
    title: t('contactTitle'),
    description: t('contactIntro'),
  }
}

export default async function MessagePage({ params, searchParams }: Props) {
  const { locale: rawLocale } = await params
  if (!(rawLocale in LOCALES)) notFound()

  const search = (await searchParams) ?? {}
  const cardId = parseCardId(search.card)
  const card = cardId ? await loadCard(cardId) : null

  return <MessageForm card={card} />
}
