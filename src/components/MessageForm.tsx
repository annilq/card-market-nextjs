'use client'

// 访客留言表单。
//
// 从 TanStack 版本移植时只改了提交通道：原来 postMessage() 走 Directus 的 REST，
// 现在 submitMessage() 是 Next 的 Server Action（见 src/lib/actions.ts）——
// 匿名访客也能提交，但写入发生在服务端，不暴露公开写接口。
// 版式与下列判断原样保留：
// - 状态区常驻 DOM，aria-live 才有机会播报；成功用 status（礼貌），失败用 alert（打断）。
// - 提交成功后把焦点移到回执并滚动过去：手机上回执在表单上方，只 focus 不滚动
//   会让焦点落在屏幕外，看起来像「什么都没发生」。
// - 按钮锁定最小宽度：文案从「提交留言」变「提交中…」时不该把旁边的次要动作顶走。
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { submitMessage } from '@/lib/actions'
import { formatYen } from '@/lib/format'
import { useLocale, useT } from '@/lib/i18n/client'
import { localizeHref } from '@/lib/i18n/locales'
import type { CardView } from '@/lib/types'

export function MessageForm({ card }: { card: CardView | null }) {
  const t = useT()
  const locale = useLocale()

  /** 用户主动移除的卡牌：只在本次访问里生效，不写回 URL。 */
  const [dismissed, setDismissed] = useState(false)
  const [content, setContent] = useState('')
  const [name, setName] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<'ok' | 'error' | null>(null)

  const successRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (result !== 'ok') return
    successRef.current?.focus({ preventScroll: true })
    successRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [result])

  const attachedCard = dismissed ? null : card
  const image = attachedCard?.images[0]
  const imageSrc = image?.thumbUrl || image?.cardUrl || image?.url || ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = content.trim()
    if (!text || submitting) return
    setSubmitting(true)
    setResult(null)
    const res = await submitMessage({
      content: text,
      contactName: name.trim() || undefined,
      contactInfo: info.trim() || undefined,
      // 用户若点击叉号移除了卡片上下文，attachedCard 为 null，card 不发送，留言即与卡牌无关。
      cardId: attachedCard?.id ?? null,
    })
    setSubmitting(false)
    if (res.ok) {
      setContent('')
      setName('')
      setInfo('')
      setResult('ok')
    } else {
      // 具体原因只进控制台：访客需要的是「发生了什么 + 下一步做什么」，
      // 不是 Server Action 内部的原始错误。
      console.error('[message] submit failed', res.error)
      setResult('error')
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">{t('contactTitle')}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{t('contactIntro')}</p>

      {/* 状态区常驻在 DOM 里（而不是按需插入），aria-live 才有机会播报变化。
          成功用 status（礼貌播报），失败用 alert（立即打断），因为失败需要行动。 */}
      <div aria-live="polite" aria-atomic="true">
        {result === 'ok' && (
          <div
            ref={successRef}
            tabIndex={-1}
            className="banner-enter mt-4 rounded-lg bg-success/15 px-4 py-3 text-sm text-success outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
          >
            {t('submitOk')}
          </div>
        )}
      </div>
      <div role="alert">
        {result === 'error' && (
          <div className="banner-enter mt-4 rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">
            {t('submitFail')}
          </div>
        )}
      </div>

      <form onSubmit={submit} className="mt-6 space-y-5">
        {/* 咨询对象：从卡牌详情「咨询此卡」进来时显示，可移除。
            没有它，用户在详情页点「咨询」后必须手打一遍卡名——全站唯一转化路径丢上下文。 */}
        {attachedCard && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
            <div className="h-[72px] w-14 shrink-0 overflow-hidden rounded-lg bg-surface-2">
              {imageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageSrc}
                  alt={image?.alt || attachedCard.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-hint">
                  {t('noImageShort')}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-faint">{t('cardContextLabel')}</div>
              <div className="truncate text-sm font-medium text-fg">{attachedCard.name}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                {attachedCard.code && (
                  <span className="text-faint">
                    {t('cardCodeShort', { code: attachedCard.code })}
                  </span>
                )}
                {attachedCard.price != null && (
                  // 价格在这一块里也用价格的令牌与字重：用户要确认的正是
                  // 「我咨询的是这张、这个价」，压成一行灰色小字等于把答案藏起来。
                  <span className="font-semibold tabular-nums text-price">
                    {t('priceTag', { price: formatYen(attachedCard.price) })}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label={t('cardContextRemove')}
              title={t('cardContextRemove')}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        )}

        <div>
          {/* label 用 htmlFor 关联：只有视觉相邻时，读屏软件听到的是 placeholder。 */}
          <label htmlFor="message-content" className="mb-1 block text-sm text-muted">
            {t('messageContent')}{' '}
            {/* 必填标记不用红：红在这个系统里是钱与错误。必填是中性信息，
                用弱化色 + 星号即可，留给错误信息一点颜色余量。 */}
            <span className="text-xs text-faint">
              <span aria-hidden="true" className="mr-0.5">
                *
              </span>
              {t('requiredMark')}
            </span>
          </label>
          <textarea
            id="message-content"
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            required
            aria-required="true"
            maxLength={2000}
            className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-fg placeholder:text-faint outline-none focus:border-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
            placeholder={t('messagePlaceholder')}
          />
          {/* 回复时限放在提交之前：这是访客决定要不要等下去的信息。 */}
          <p className="mt-1 text-xs text-faint">{t('replyHint')}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="message-name" className="mb-1 block text-sm text-muted">
              {t('contactName')} <span className="text-xs text-faint">{t('optionalMark')}</span>
            </label>
            <input
              id="message-name"
              name="contactName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-fg placeholder:text-faint outline-none focus:border-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
              placeholder={t('contactName')}
            />
          </div>
          <div>
            <label htmlFor="message-info" className="mb-1 block text-sm text-muted">
              {t('contactInfo')} <span className="text-xs text-faint">{t('optionalMark')}</span>
            </label>
            <input
              id="message-info"
              name="contactInfo"
              value={info}
              onChange={(e) => setInfo(e.target.value)}
              autoComplete="email"
              className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-fg placeholder:text-faint outline-none focus:border-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
              placeholder={t('contactInfoPlaceholder')}
            />
          </div>
        </div>
        {/* 说的是「为什么需要」，不是重复字段名。 */}
        <p className="text-xs text-faint">{t('contactHint')}</p>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            // 锁定宽度：文案从「提交留言」变「提交中…」时按钮不该跟着变宽，
            // 否则旁边那个次要动作会横向跳一格。
            className="inline-flex min-w-32 items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm text-on-accent transition-colors duration-150 hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted disabled:opacity-60"
          >
            {submitting && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="animate-spin motion-reduce:hidden"
                aria-hidden="true"
              >
                <path d="M12 3a9 9 0 1 0 9 9" />
              </svg>
            )}
            {submitting ? t('submitting') : t('submitMessage')}
          </button>
          <Link
            href={localizeHref('/cards', locale)}
            className="inline-flex min-h-6 items-center text-sm text-muted hover:text-fg hover:underline"
          >
            {t('browseCards')}
          </Link>
        </div>
      </form>

      {/* 返回首页与提交区分开：它和「浏览卡牌」同属次要出口，但不在同一个
          动作组里，挤在提交按钮下方 8px 会读成表单的一部分。 */}
      <div className="mt-8 border-t border-border pt-5">
        <Link
          href={localizeHref('/', locale)}
          className="inline-flex min-h-6 items-center text-sm text-muted transition-colors duration-150 hover:text-fg hover:underline"
        >
          {t('backHomeArrow')}
        </Link>
      </div>
    </div>
  )
}
