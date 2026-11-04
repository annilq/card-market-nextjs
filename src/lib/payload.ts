import configPromise from '@payload-config'
import { getPayload, type Payload } from 'payload'

// 真正的「跨请求」单例：挂到 globalThis，让 Payload 在一个进程 / 一个 serverless
// 实例内只初始化一次（连库 + 建 schema）。
//
// 原本用 React 的 `cache()`，它只在「单次渲染（= 单次 HTTP 请求）」内去重，
// 下一次请求仍会重新 getPayload —— 在 Vercel 上等于每次页面跳转都白付一次
// 2~4s 的初始化开销（见 scripts/bench.ts 的「首次查询」）。改成 globalThis
// 持有 Promise 后，初始化只在冷启动（实例首次被访问）时发生一次，之后所有
// 请求复用同一个连接池与已编译的 schema。
const globalForPayload = globalThis as unknown as {
  __payloadClientPromise?: Promise<Payload>
}

export function getPayloadClient(): Promise<Payload> {
  if (!globalForPayload.__payloadClientPromise) {
    globalForPayload.__payloadClientPromise = getPayload({ config: configPromise })
  }
  return globalForPayload.__payloadClientPromise
}
