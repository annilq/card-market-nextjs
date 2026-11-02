import configPromise from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { cache } from 'react'

/**
 * Payload 的 Local API：同一个进程里直接查库，不走 HTTP。
 * 这是与 Directus 方案最大的架构差异——那边前端必须经 REST 到另一个容器。
 */
export const getPayloadClient = cache(async (): Promise<Payload> => {
  return getPayload({ config: configPromise })
})
