import { Gutter } from '@payloadcms/ui'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { redirect } from 'next/navigation'
import React from 'react'
import type { AdminViewServerProps } from 'payload'

import { BulkCardsClient, type BulkCardsTaxonomy, type TaxonomyOption } from './BulkCardsClient'

function toOption(doc: TaxonomyOption): TaxonomyOption {
  return { id: doc.id, name: doc.name }
}

function toRelationID(value: number | { id: number }): number {
  return typeof value === 'number' ? value : value.id
}

export async function BulkCardsView({
  initPageResult,
  params,
  searchParams,
  user,
}: AdminViewServerProps) {
  const { permissions, req } = initPageResult
  const canCreateCards = permissions.collections?.cards?.create === true
  const canCreateMedia = permissions.collections?.media?.create === true

  // 没有建卡与建素材权限的账号进不来：这个页面最终会同时写两张表。
  if (!canCreateCards || !canCreateMedia) {
    redirect(`${req.payload.config.routes.admin}/unauthorized`)
  }

  const { admin: adminRoute, api: apiRoute } = req.payload.config.routes

  const enabledQuery = {
    where: { enabled: { equals: true } },
    limit: 0,
    depth: 0,
    sort: 'sort',
    overrideAccess: false,
    req,
  }

  const [ips, series, subSeries, rarities, cardStatuses] = await Promise.all([
    req.payload.find({ ...enabledQuery, collection: 'ips' }),
    req.payload.find({ ...enabledQuery, collection: 'series' }),
    req.payload.find({ ...enabledQuery, collection: 'sub-series' }),
    req.payload.find({ ...enabledQuery, collection: 'rarities' }),
    req.payload.find({ ...enabledQuery, collection: 'card-statuses' }),
  ])

  const taxonomy: BulkCardsTaxonomy = {
    ips: ips.docs.map(toOption),
    series: series.docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      ipId: toRelationID(doc.ip),
    })),
    subSeries: subSeries.docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      seriesId: toRelationID(doc.series),
    })),
    rarities: rarities.docs.map(toOption),
    cardStatuses: cardStatuses.docs.map(toOption),
  }

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
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter className="admin-bulk-cards">
        <BulkCardsClient adminRoute={adminRoute} apiRoute={apiRoute} taxonomy={taxonomy} />
      </Gutter>
    </DefaultTemplate>
  )
}

export default BulkCardsView
