import { Gutter, Link } from '@payloadcms/ui'
import { Image as ImageIcon, Link2, MousePointerClick } from 'lucide-react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import React from 'react'
import type { AdminViewServerProps } from 'payload'

import { createAdminT, type AdminMessageKey, type AdminT } from '@/lib/admin/i18n'
import { getOrigin } from '@/lib/site-url'
import { explainLinkPatterns } from '@/lib/admin/public-links'

import './admin-ui.css'

/**
 * 后台帮助页（/admin/help）。给运营的一份操作说明，内容是这一版后台里
 * 最容易出错的几处：怎么拿链接、图片该多大、状态与发布、编号唯一、排序、
 * alt、删除、语言。
 *
 * 链接示例从 public-links.ts 的同一张登记表生成，改路由时这里跟着变，
 * 不会写死一份对不上的清单。
 */

type Step = { body: string; title: string }
type Section = { body?: string; id: string; intro?: string; steps?: Step[]; title: string }

function buildSections(
  origin: string,
  t: AdminT,
): { examples: { example: string; labelKey: AdminMessageKey }[]; sections: Section[] } {
  const examples = explainLinkPatterns(origin)
  const cardExample = `${origin}/cards/123`

  const sections: Section[] = [
    {
      id: 'links',
      title: t('help.links.title'),
      intro: t('help.links.intro'),
      steps: [
        { title: t('help.links.step1.title'), body: t('help.links.step1.body') },
        {
          title: t('help.links.step2.title'),
          body: t('help.links.step2.body', { cardExample }),
        },
        { title: t('help.links.step3.title'), body: t('help.links.step3.body') },
      ],
    },
    {
      id: 'patterns',
      title: t('help.patterns.title'),
      intro: t('help.patterns.intro'),
    },
    {
      id: 'filters',
      title: t('help.filters.title'),
      intro: t('help.filters.intro'),
      steps: [
        { title: t('help.filters.ip.title'), body: t('help.filters.ip.body', { origin }) },
        {
          title: t('help.filters.series.title'),
          body: t('help.filters.series.body', { origin }),
        },
        {
          title: t('help.filters.highValue.title'),
          body: t('help.filters.highValue.body', { origin }),
        },
        {
          title: t('help.filters.price.title'),
          body: t('help.filters.price.body', { origin }),
        },
        {
          title: t('help.filters.keyword.title'),
          body: t('help.filters.keyword.body', { origin }),
        },
      ],
    },
    {
      id: 'images',
      title: t('help.images.title'),
      steps: [
        {
          title: t('help.images.banner.title'),
          body: t('help.images.banner.body'),
        },
        {
          title: t('help.images.card.title'),
          body: t('help.images.card.body'),
        },
        {
          title: t('help.images.shop.title'),
          body: t('help.images.shop.body'),
        },
        {
          title: t('help.images.alt.title'),
          body: t('help.images.alt.body'),
        },
      ],
    },
    {
      id: 'bulk',
      title: t('help.bulk.title'),
      intro: t('help.bulk.intro'),
      steps: [
        {
          title: t('help.bulk.upload.title'),
          body: t('help.bulk.upload.body'),
        },
        {
          title: t('help.bulk.fill.title'),
          body: t('help.bulk.fill.body'),
        },
        {
          title: t('help.bulk.save.title'),
          body: t('help.bulk.save.body'),
        },
        {
          title: t('help.bulk.keys.title'),
          body: t('help.bulk.keys.body'),
        },
        {
          title: t('help.bulk.dup.title'),
          body: t('help.bulk.dup.body'),
        },
      ],
    },
    {
      id: 'status',
      title: t('help.status.title'),
      steps: [
        {
          title: t('help.status.draft.title'),
          body: t('help.status.draft.body'),
        },
        {
          title: t('help.status.schedule.title'),
          body: t('help.status.schedule.body'),
        },
      ],
    },
    {
      id: 'code',
      title: t('help.code.title'),
      body: t('help.code.body'),
    },
    {
      id: 'taxonomy',
      title: t('help.taxonomy.title'),
      intro: t('help.taxonomy.intro'),
      steps: [
        {
          title: t('help.taxonomy.order.title'),
          body: t('help.taxonomy.order.body'),
        },
        {
          title: t('help.taxonomy.clear.title'),
          body: t('help.taxonomy.clear.body'),
        },
        {
          title: t('help.taxonomy.empty.title'),
          body: t('help.taxonomy.empty.body'),
        },
      ],
    },
    {
      id: 'sort',
      title: t('help.sort.title'),
      body: t('help.sort.body'),
    },
    {
      id: 'delete',
      title: t('help.delete.title'),
      body: t('help.delete.body'),
    },
    {
      id: 'locale',
      title: t('help.locale.title'),
      body: t('help.locale.body'),
    },
  ]

  return { examples, sections }
}

export async function HelpView({
  initPageResult,
  params,
  searchParams,
  user,
  viewActions,
}: AdminViewServerProps) {
  const origin = await getOrigin()
  const t = createAdminT(initPageResult.req.i18n.language)
  const { examples, sections } = buildSections(origin, t)

  // 根视图（Root View）默认是「裸」渲染：Payload 的 Root 路由只在
  // templateType === 'default' 时才套 DefaultTemplate（含侧栏 Nav + 顶栏 Header），
  // 而按路由匹配的自定义根视图不会自动设置 templateType。所以必须显式用
  // DefaultTemplate 包裹，才能复用管理端通用布局（左侧菜单、顶栏都在）。
  // 数据取自 AdminViewServerProps：req/payload/permissions/visibleEntities 走
  // initPageResult，params/searchParams/user 直接取。
  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      req={initPageResult.req}
      searchParams={searchParams}
      user={user}
      viewActions={viewActions}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter className="admin-help">
      <header className="admin-help__header">
        <h1 className="admin-help__title">{t('help.pageTitle')}</h1>
        <p className="admin-help__lead">{t('help.lead')}</p>
      </header>

      <nav className="admin-help__toc" aria-label={t('help.toc')}>
        {sections.map((s, i) => (
          <a className="admin-help__toc-link" href={`#help-${s.id}`} key={s.id}>
            {i + 1}. {s.title}
          </a>
        ))}
      </nav>

      {sections.map((section, index) => (
        <section className="admin-help__section" id={`help-${section.id}`} key={section.id}>
          <h2 className="admin-help__section-title">
            <span className="admin-help__num">{index + 1}</span>
            {section.title}
          </h2>
          {section.intro ? <p className="admin-help__text">{section.intro}</p> : null}

          {section.body ? <p className="admin-help__text">{section.body}</p> : null}

          {section.id === 'links' ? (
            <p className="admin-help__cta">
              <MousePointerClick className="admin-help__inline-icon" />
              {t('help.copyHint')}
            </p>
          ) : null}

          {section.id === 'patterns' ? (
            <div className="admin-help__table-wrap">
              <table className="admin-help__table">
                <thead>
                  <tr>
                    <th>{t('help.table.page')}</th>
                    <th>{t('help.table.example')}</th>
                  </tr>
                </thead>
                <tbody>
                  {examples.map((e) => (
                    <tr key={e.example}>
                      <td>{t(e.labelKey)}</td>
                      <td>
                        <code className="admin-help__code">{e.example}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {section.steps ? (
            <ol className="admin-help__steps">
              {section.steps.map((step) => (
                <li className="admin-help__step" key={step.title}>
                  <span className="admin-help__step-title">{step.title}</span>
                  <span className="admin-help__step-body">{step.body}</span>
                </li>
              ))}
            </ol>
          ) : null}

          {section.id === 'images' ? (
            <p className="admin-help__hint">
              <ImageIcon className="admin-help__inline-icon" />
              {t('help.imagesHint')}
            </p>
          ) : null}

          {section.id === 'links' ? (
            <p className="admin-help__hint">
              <Link2 className="admin-help__inline-icon" />
              {t('help.linksHint')}
            </p>
          ) : null}
        </section>
      ))}

      <footer className="admin-help__footer">
        <Link href="/admin" className="admin-help__back">
          {t('help.back')}
        </Link>
      </footer>
      </Gutter>
    </DefaultTemplate>
  )
}

export default HelpView
