// 卡牌详情页：图集 + 规格面板 + （上架时间 / 描述）细节卡 + 手机端粘性咨询条 + 底部同类卡。
//
// 移植自 TanStack 版的 `{-$locale}.cards.$id.tsx`。版式、动效与「为什么这样排」
// 的判断原样保留（分类眉标、min-w-0、vt-card 共享元素、换图淡入、粘性条），
// 只换了数据来源（Directus → Payload 的 CardView）与链接方式（next/link + localizeHref）。

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ContentLanguageNotice } from '@/components/ContentLanguageNotice'
import { CardGallery } from '@/components/catalog/CardGallery'
import { CardInfo } from '@/components/catalog/CardInfo'
import { RelatedCards } from '@/components/catalog/RelatedCards'
import { getCard } from '@/lib/data'
import { formatYen } from '@/lib/format'
import { LOCALES, localizeHref } from '@/lib/i18n/locales'
import type { Locale } from '@/lib/i18n/locales'
import { formatDate, getTranslator } from '@/lib/i18n/t'
import { getOrigin } from '@/lib/site-url'

// 卡牌可随时上下架，且描述是后台富文本：不做静态化，每次请求都读库。
export const dynamic = 'force-dynamic'

/** canonical / og:image 必须是绝对地址，写相对路径爬虫会直接忽略。主机取请求 host（见 src/lib/site-url）。 */

type Props = {
  params: Promise<{ locale: string; id: string }>
}

/** 语言段不受支持 → 404（不是一个「内容缺失」的页面，而是没有这个地址）。 */
function requireLocale(raw: string): Locale {
  if (!(raw in LOCALES)) notFound()
  return raw as Locale
}

/** 路径段 → 卡牌主键。非正整数一律 404：数据库主键不会是 0、负数或小数。 */
function requireId(raw: string): number {
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) notFound()
  return id
}

async function absoluteUrl(path: string): Promise<string> {
  const origin = await getOrigin()
  return new URL(path, origin).toString()
}

/** 富文本转纯文本摘要，供 meta description 使用。 */
function plainText(html: string | null | undefined, max = 140): string {
  if (!html) return ''
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, id } = await params
  const locale = requireLocale(raw)
  const t = getTranslator(locale)
  const numericId = Number(id)
  const canonical = await absoluteUrl(localizeHref(`/cards/${encodeURIComponent(id)}`, locale))
  const card = Number.isInteger(numericId) && numericId > 0 ? await getCard(numericId) : null

  // 查不到卡时标 noindex——一张空白详情页被收录只会拉低整站的索引质量。
  if (!card) {
    const title = t('cardNotFound')
    return {
      title,
      description: title,
      alternates: { canonical },
      robots: { index: false, follow: true },
    }
  }

  // 标题带卡名（站名由根布局的 `%s | 站名` 模板追加，这里不重复拼），
  // 描述带价格 / 编号 / 罕见度 / 成色，分享图用第一张卡图。
  const facts = [
    card.price != null ? t('priceTag', { price: formatYen(card.price) }) : t('priceOnRequest'),
    card.code ? t('cardCode', { code: card.code }) : '',
    card.rarityName ?? '',
    t(card.cardStatus === 'packaged' ? 'statusPackaged' : 'statusRaw'),
  ]
    .filter(Boolean)
    .join(' · ')
  const taxonomy = [card.ipName, card.seriesName, card.subSeriesName].filter(Boolean).join(' / ')
  const description = [taxonomy, facts, plainText(card.descriptionHtml)]
    .filter(Boolean)
    .join(' ｜ ')
  const image = card.images[0]

  return {
    title: card.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title: card.name,
      description,
      url: canonical,
      images: image
        ? [
            {
              url: await absoluteUrl(image.bannerUrl || image.cardUrl || image.url),
              alt: image.alt || card.name,
            },
          ]
        : undefined,
    },
  }
}

export default async function CardDetailPage({ params }: Props) {
  const { locale: raw, id } = await params
  const locale = requireLocale(raw)
  const cardId = requireId(id)
  const t = getTranslator(locale)

  // 卡牌本体。底部同类卡由 RelatedCards 自己取（它要判「同 IP 够不够一排」，
  // 不够就换最新上架），因此这一页只发一个必须的请求。
  const card = await getCard(cardId)

  // 下架的卡不 404 整个路由：地址还在、人可能从聊天记录点进来，
  // 给一句说明 + 一条回列表的路（上面 generateMetadata 已标 noindex）。
  if (!card) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted">{t('cardNotFound')}</p>
        <Link
          href={localizeHref('/cards', locale)}
          className="mt-3 inline-flex min-h-9 items-center text-fg underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
        >
          {t('backToCards')}
        </Link>
      </div>
    )
  }

  const inquireHref = localizeHref(`/message?card=${card.id}`, locale)
  const priceLabel =
    card.price != null ? t('priceTag', { price: formatYen(card.price) }) : t('priceOnRequest')
  const taxonomy = [card.ipName, card.seriesName, card.subSeriesName].filter(Boolean).join(' · ')

  return (
    // pb-20 md:pb-0：手机底部那条粘性咨询条是 fixed 的，不给文档流留高度
    // 就会盖住最后一行（现在这一行是底部同类卡网格的最后一行）。
    <div className="pb-20 md:pb-0">
      {/* 内容语言说明：卡牌名/描述是后台单一语言录入的，非默认语言页面上要说明这条边界。
          pathname 指回当前卡，让「查看中文原文」精确落在同一张卡上。 */}
      <ContentLanguageNotice locale={locale} pathname={`/cards/${card.id}`} />

      {/* min-w-0：grid 子项默认 min-width:auto，一张超长无空格的卡名会把整列顶宽，
          进而撑破视口（break-words 只影响换行，不降低 min-content）。 */}
      <div className="mt-3 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <CardGallery
            images={card.images}
            alt={card.name}
            galleryLabel={t('galleryLabel')}
            thumbLabels={card.images.map((_, i) => t('galleryThumb', { n: i + 1 }))}
            emptyLabel={t('noImage')}
            vtName={`card-${card.id}`}
          />
        </div>

        <div className="min-w-0">
          {/* 分类眉标：IP · 系列 · 子系列。这一页这三个值只出现一次——规格表里
              再写一遍就成了「同一信息两处」（源码对罕见度就是这么判断的）。 */}
          {taxonomy && <div className="text-xs text-faint">{taxonomy}</div>}

          {/* 与弹窗共用同一个信息组件（设计要求）：徽章 + 名称/编号/状态 + 价格。
              这一列不拉伸，CardInfo 里那块 mt-auto 没有多余高度可占，
              价格就紧跟在三行下面。桌面：价格与「咨询此卡」同屏可见。 */}
          <div className="mt-3 rounded-xl border border-border bg-surface p-5">
            <CardInfo
              card={card}
              locale={locale}
              nameAs="h1"
              actions={
                // 桌面 CTA 紧跟价格：价格与「问这张卡」是同一件事的两面。
                // 手机端 CTA 交给底部粘性条，避免同一页两个主按钮。
                <div className="mt-4 hidden gap-3 md:flex">
                  <Link
                    href={inquireHref}
                    className="rounded-lg bg-accent px-4 py-2 text-sm text-on-accent transition-colors duration-150 hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
                  >
                    {t('inquireCard')}
                  </Link>
                  <Link
                    href={localizeHref('/cards', locale)}
                    className="rounded-lg border border-border-strong px-4 py-2 text-sm text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
                  >
                    {t('backToList')}
                  </Link>
                </div>
              }
            />
          </div>

          {/* 上架时间与描述同属「这张卡的细节」，收进同一张卡片里，
              与页面底色隔开；两者之间仍用一条分隔线（源码里原本就是带 border-t 的两段）。
              不塞进上面那张信息卡：信息卡要短——价格离卡名越近，这一页越像在报价。 */}
          {(card.createdAt || card.descriptionHtml) && (
            <div className="mt-5 rounded-xl border border-border bg-surface p-5">
              {card.createdAt && (
                <div className="text-sm text-faint">
                  {t('listedAt')}：
                  <time className="tabular-nums text-muted" dateTime={card.createdAt}>
                    {formatDate(card.createdAt, locale)}
                  </time>
                </div>
              )}

              {card.descriptionHtml && (
                <div className={card.createdAt ? 'mt-5 border-t border-border pt-5' : ''}>
                  <div className="mb-1.5 text-sm text-faint">{t('description')}</div>
                  {/* 正文来自后台富文本（数据层已把 Payload Lexical 转成受控 HTML），
                      样式与公告详情页同一套 `.prose` 修饰，避免两处正文长得不一样。 */}
                  <div
                    className="prose text-body [&_a]:text-link [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted [&_code]:rounded [&_code]:bg-muted/10 [&_code]:px-1 [&_em]:italic [&_h1]:mb-2 [&_h1]:mt-6 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-fg [&_h2]:mb-1.5 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-fg [&_h3]:font-semibold [&_h3]:text-fg [&_hr]:border-border [&_img]:my-2 [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:leading-relaxed [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
                    dangerouslySetInnerHTML={{ __html: card.descriptionHtml }}
                  />
                </div>
              )}
            </div>
          )}

          {/* 手机：返回列表是次要动作，留在文档流末尾。 */}
          <div className="mt-6 md:hidden">
            <Link
              href={localizeHref('/cards', locale)}
              className="inline-flex min-h-8 items-center text-sm text-muted transition-colors duration-150 hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
            >
              {t('backToList')}
            </Link>
          </div>
        </div>
      </div>

      {/* 同类卡：详情页的出口（见 RelatedCards 里的取数说明）。 */}
      <RelatedCards card={card} locale={locale} />

      {/* 手机底部粘性操作条：详情页全站唯一的转化路径，不该要求用户
          滚过描述才看得到。安全区内边距让它在刘海屏上不被横条压住。 */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-4 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-faint">{card.name}</div>
            <div className="text-price font-semibold tabular-nums">{priceLabel}</div>
          </div>
          <Link
            href={inquireHref}
            className="shrink-0 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent/90"
          >
            {t('inquireCard')}
          </Link>
        </div>
      </div>
    </div>
  )
}
