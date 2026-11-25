import { Gutter, Link } from '@payloadcms/ui'
import { ArrowRight, Eye, Inbox, Megaphone, Package, Plus, Store } from 'lucide-react'
import type { Payload } from 'payload'
import React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { adminDateLocale, createAdminT, type AdminMessageKey, type AdminT } from '@/lib/admin/i18n'

import { AdminLocalDateTime } from './AdminLocalDateTime'
import { ENTITY_DESCRIPTION_KEYS, ENTITY_FALLBACK_ICON, ENTITY_ICONS } from './entity-meta'
import { formatYen } from '@/lib/format'
import type { Card as CardDoc, Message } from '@/payload-types'

type NavGroup = {
  entities: { label: unknown; slug: string; type: 'collections' | 'globals' }[]
  label: string
}

type Props = {
  i18n: { language: string }
  locale?: string
  navGroups?: NavGroup[]
  payload: Payload
  user?: { email?: string | null } | null
}

/** 单个查询失败不能让整页空白：后台的可观测性比「要么全有要么全无」重要。 */
async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise
  } catch {
    return null
  }
}

function toLabel(label: unknown, language: string, fallback: string): string {
  if (typeof label === 'string') return label
  if (label && typeof label === 'object') {
    const record = label as Record<string, unknown>
    for (const key of [language, 'ja', 'en', 'zh']) {
      if (typeof record[key] === 'string') return record[key] as string
    }
  }
  return fallback
}

function formatCount(value: number | null | undefined, locale: string): string {
  if (typeof value !== 'number') return '—'
  return new Intl.NumberFormat(locale).format(value)
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return '—'
  return `¥${formatYen(value)}`
}

function formatRelative(value: string | null | undefined, locale: string): React.ReactNode {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.round(diffMs / 60000)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (Math.abs(minutes) < 60) return formatter.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(-hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return formatter.format(-days, 'day')
  return <AdminLocalDateTime value={value} />
}

type StatusValue = 'archived' | 'draft' | 'published'

const STATUS_META: Record<
  StatusValue,
  { labelKey: AdminMessageKey; variant: 'muted' | 'outline' | 'success' }
> = {
  published: { labelKey: 'status.published', variant: 'success' },
  draft: { labelKey: 'status.draft', variant: 'muted' },
  archived: { labelKey: 'status.archived', variant: 'outline' },
}

function StatusBadge({ status, t }: { status?: StatusValue | null; t: AdminT }) {
  const meta = status ? STATUS_META[status] : undefined
  return (
    <Badge variant={meta?.variant ?? 'outline'}>
      {meta ? t(meta.labelKey) : t('status.unknown')}
    </Badge>
  )
}

type Stat = {
  hint: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | null
  emphasis?: boolean
}

/**
 * 统计条：一张卡、四格、格间一条 1px 线。
 *
 * 分隔线不用 `divide-*`（两列布局时它会画在错误的位置），而是用
 * `gap-px` + 容器底色：底色从格子的缝隙里透出来，一行排几列都对。
 */
function StatStrip({ locale, stats }: { locale: string; stats: Stat[] }) {
  return (
    <Card className="admin-stat-strip">
      <CardContent className="p-0">
        <dl className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div className="bg-card px-5 py-4" key={stat.label}>
                <dt className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <Icon className="size-3.5" />
                  {stat.label}
                </dt>
                <dd className="mt-2">
                  <span
                    className={[
                      'tabular block text-[26px] leading-none font-semibold tracking-[-0.02em]',
                      stat.emphasis ? 'text-primary' : 'text-foreground',
                    ].join(' ')}
                  >
                    {formatCount(stat.value, locale)}
                  </span>
                  <span className="mt-1.5 block text-[12px] text-muted-foreground">
                    {stat.hint}
                  </span>
                </dd>
              </div>
            )
          })}
        </dl>
      </CardContent>
    </Card>
  )
}

/**
 * 仪表盘（替换 Payload 默认的「集合卡片墙」）。
 *
 * 默认那一屏是几组巨大的空卡片：一个方框、一个标题、一个「+」，
 * 在 1440 宽的屏幕上大半页是空白，运营者扫一眼得不到任何信息。
 * 这里换成运维真正会看的三件事：
 *
 *   1. 规模与积压：卡牌 / 公告 / 待处理留言 / 门店 四个数；
 *   2. 最近动过什么：最近更新的卡牌，直接带编辑入口；
 *   3. 还欠什么：未处理的留言，按时间倒序，点进去就是那条工单。
 *
 * 底部保留一份按分组排列的集合索引——它承担原来「卡片墙」的导航职责，
 * 但换成一行一条的紧凑列表，扫读时眼睛只走一条竖线。
 *
 * 服务端组件：数据在服务端取（走 Local API，不受前台 read 权限限制），
 * 页面不发任何客户端查询。
 */
export async function DashboardView({ i18n, navGroups = [], payload, user }: Props) {
  const t = createAdminT(i18n.language)
  const dateLocale = adminDateLocale(i18n.language)
  const [cardsTotal, cardsPublished, announcementsTotal, announcementsPublished, messagesNew, messagesTotal, shopsTotal, shopsPublished, recentCards, recentMessages] =
    await Promise.all([
      safe(payload.count({ collection: 'cards', overrideAccess: true })),
      safe(
        payload.count({
          collection: 'cards',
          overrideAccess: true,
          where: { status: { equals: 'published' } },
        }),
      ),
      safe(payload.count({ collection: 'announcements', overrideAccess: true })),
      safe(
        payload.count({
          collection: 'announcements',
          overrideAccess: true,
          where: { status: { equals: 'published' } },
        }),
      ),
      safe(
        payload.count({
          collection: 'messages',
          overrideAccess: true,
          where: { status: { equals: 'new' } },
        }),
      ),
      safe(payload.count({ collection: 'messages', overrideAccess: true })),
      safe(payload.count({ collection: 'shops', overrideAccess: true })),
      safe(
        payload.count({
          collection: 'shops',
          overrideAccess: true,
          where: { status: { equals: 'published' } },
        }),
      ),
      safe(
        payload.find({
          collection: 'cards',
          depth: 0,
          limit: 5,
          overrideAccess: true,
          sort: '-updatedAt',
        }),
      ),
      safe(
        payload.find({
          collection: 'messages',
          depth: 0,
          limit: 5,
          overrideAccess: true,
          sort: '-createdAt',
          where: { status: { equals: 'new' } },
        }),
      ),
    ])

  const cards = (recentCards?.docs ?? []) as CardDoc[]
  const messages = (recentMessages?.docs ?? []) as Message[]
  const pending = messagesNew?.totalDocs ?? null

  const stats: Stat[] = [
    {
      hint: t('dashboard.stats.cardsHint', {
        count: formatCount(cardsPublished?.totalDocs, dateLocale),
      }),
      icon: Package,
      label: t('dashboard.stats.cards'),
      value: cardsTotal?.totalDocs ?? null,
    },
    {
      hint: t('dashboard.stats.announcementsHint', {
        count: formatCount(announcementsPublished?.totalDocs, dateLocale),
      }),
      icon: Megaphone,
      label: t('dashboard.stats.announcements'),
      value: announcementsTotal?.totalDocs ?? null,
    },
    {
      emphasis: (pending ?? 0) > 0,
      hint: t('dashboard.stats.pendingHint', {
        count: formatCount(messagesTotal?.totalDocs, dateLocale),
      }),
      icon: Inbox,
      label: t('dashboard.stats.pending'),
      value: pending,
    },
    {
      hint: t('dashboard.stats.shopsHint', {
        count: formatCount(shopsPublished?.totalDocs, dateLocale),
      }),
      icon: Store,
      label: t('dashboard.stats.shops'),
      value: shopsTotal?.totalDocs ?? null,
    },
  ]

  const groups = navGroups.filter((group) => group.entities.length > 0)

  return (
    <Gutter className="admin-dashboard">
      <div className="mx-auto w-full max-w-[1180px] py-8" data-admin-ui="">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.02em]">
              {t('dashboard.overview')}
            </h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">{t('dashboard.lead')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <a href="/" rel="noreferrer" target="_blank">
                <Eye />
                {t('dashboard.viewSite')}
              </a>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/collections/cards/create">
                <Plus />
                {t('dashboard.newCard')}
              </Link>
            </Button>
          </div>
        </header>

        <StatStrip locale={dateLocale} stats={stats} />

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{t('dashboard.recent')}</CardTitle>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/admin/collections/cards">
                    {t('dashboard.allCards')}
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
              <CardDescription>{t('dashboard.recentDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {cards.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  {t('dashboard.noCardsBefore')}
                  <Link className="mx-1 text-primary underline underline-offset-4" href="/admin/collections/cards/create">
                    {t('dashboard.noCardsAction')}
                  </Link>
                  {t('dashboard.noCardsAfter')}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('dashboard.table.card')}</TableHead>
                      <TableHead>{t('dashboard.table.code')}</TableHead>
                      <TableHead className="text-right">{t('dashboard.table.price')}</TableHead>
                      <TableHead>{t('dashboard.table.status')}</TableHead>
                      <TableHead className="whitespace-nowrap">
                        {t('dashboard.table.updated')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cards.map((card) => (
                      <TableRow key={card.id}>
                        <TableCell className="max-w-[240px]">
                          <Link
                            className="block truncate font-medium text-foreground no-underline hover:text-primary hover:underline hover:underline-offset-4"
                            href={`/admin/collections/cards/${card.id}`}
                          >
                            {card.name}
                          </Link>
                        </TableCell>
                        <TableCell className="tabular text-muted-foreground">
                          {card.code || '—'}
                        </TableCell>
                        <TableCell className="tabular text-right">
                          {formatMoney(card.price)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={card.status as StatusValue} t={t} />
                        </TableCell>
                        <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                          <AdminLocalDateTime value={card.updatedAt} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{t('dashboard.pendingTitle')}</CardTitle>
                  {pending ? (
                    <Badge variant="default">
                      {t('dashboard.pendingBadge', { count: formatCount(pending, dateLocale) })}
                    </Badge>
                  ) : null}
                </div>
                <CardDescription>{t('dashboard.pendingDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                {messages.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    {t('dashboard.pendingEmpty')}
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {messages.map((message, index) => (
                      <li key={message.id}>
                        {index > 0 ? <Separator className="my-3" /> : null}
                        <Link
                          className="group block no-underline"
                          href={`/admin/collections/messages/${message.id}`}
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-[13px] font-medium text-foreground group-hover:text-primary">
                              {message.contactName?.trim() || t('dashboard.anonymous')}
                            </span>
                            <span className="tabular shrink-0 text-[11px] text-muted-foreground">
                              {formatRelative(message.createdAt, dateLocale)}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">
                            {message.content}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.quick')}</CardTitle>
                <CardDescription>{t('dashboard.quickDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 px-5 pb-5">
                <Button asChild size="sm" variant="secondary">
                  <Link href="/admin/collections/cards/create">{t('dashboard.quick.newCard')}</Link>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link href="/admin/collections/announcements/create">
                    {t('dashboard.quick.announcement')}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link href="/admin/collections/media/create">{t('dashboard.quick.media')}</Link>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link href="/admin/collections/messages?where[or][0][and][0][status][equals]=new">
                    {t('dashboard.quick.messages')}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link href="/admin/globals/site-settings">{t('dashboard.quick.settings')}</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <section className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.collections')}</CardTitle>
              <CardDescription>{t('dashboard.collectionsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {groups.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  {t('dashboard.collectionsEmpty')}
                </p>
              ) : (
                <div className="flex flex-col gap-5">
                  {groups.map((group) => (
                    <div key={group.label}>
                      <div className="mb-1.5 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                        {group.label}
                      </div>
                      <ul className="divide-y divide-border/70">
                        {group.entities.map((entity) => {
                          const Icon = ENTITY_ICONS[entity.slug as keyof typeof ENTITY_ICONS] ?? ENTITY_FALLBACK_ICON
                          const base =
                            entity.type === 'collections'
                              ? `/admin/collections/${entity.slug}`
                              : `/admin/globals/${entity.slug}`
                          return (
                            <li key={`${entity.type}-${entity.slug}`}>
                              <div className="group flex items-center gap-3 py-2.5">
                                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                                  <Icon className="size-3.5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <Link
                                    className="block truncate text-[13px] font-medium text-foreground no-underline hover:text-primary hover:underline hover:underline-offset-4"
                                    href={base}
                                  >
                                    {toLabel(entity.label, i18n.language, entity.slug)}
                                  </Link>
                                  {ENTITY_DESCRIPTION_KEYS[entity.slug] ? (
                                    <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                                      {t(ENTITY_DESCRIPTION_KEYS[entity.slug])}
                                    </p>
                                  ) : null}
                                </div>
                                  {/* 常驻可见，hover 时加深：藏起来的操作等于没有。 */}
                                {entity.type === 'collections' ? (
                                  <Button
                                    asChild
                                    className="text-muted-foreground hover:text-foreground"
                                    size="sm"
                                    variant="ghost"
                                  >
                                    <Link href={`${base}/create`}>
                                      <Plus />
                                      {t('dashboard.create')}
                                    </Link>
                                  </Button>
                                ) : null}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {user?.email ? (
          <p className="mt-6 text-[12px] text-muted-foreground">
            {t('dashboard.signedInAs', { email: user.email })}
          </p>
        ) : null}
      </div>
    </Gutter>
  )
}

export default DashboardView
