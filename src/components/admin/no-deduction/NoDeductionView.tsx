import { Gutter } from '@payloadcms/ui'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { redirect } from 'next/navigation'
import React from 'react'
import type { AdminViewServerProps } from 'payload'

import { NoDeductionList } from './NoDeductionList'

export async function NoDeductionView({
  initPageResult,
  params,
  searchParams,
  user,
}: AdminViewServerProps) {
  const { permissions, req } = initPageResult
  const canRead = permissions.collections?.cards?.read === true
  const canUpdate = permissions.collections?.cards?.update === true
  if (!canRead) redirect(`${req.payload.config.routes.admin}/unauthorized`)

  const { admin: adminRoute, api: apiRoute } = req.payload.config.routes
  const rawPage = Number(searchParams?.page ?? 1)
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const pageSize = 50

  const result = await req.payload.find({
    collection: 'cards',
    where: { isNoDeduction: { equals: true } },
    sort: ['sort', '-createdAt'],
    depth: 0,
    limit: pageSize,
    page,
    overrideAccess: false,
    req,
  })

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
        <NoDeductionList
          adminRoute={adminRoute}
          apiRoute={apiRoute}
          canUpdate={canUpdate}
          cards={result.docs.map((doc) => ({
            id: doc.id,
            name: doc.name,
            code: doc.code ?? null,
            sort: doc.sort ?? null,
          }))}
          page={result.page ?? page}
          totalPages={result.totalPages}
          total={result.totalDocs}
        />
      </Gutter>
    </DefaultTemplate>
  )
}

export default NoDeductionView
