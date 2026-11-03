import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

// 始终动态执行：Uptime Kuma / 探针每次都要真实打库
export const dynamic = 'force-dynamic'

/**
 * 健康检查：验证「Next 进程 + Payload + PostgreSQL」整条链路。
 * 返回 200 表示业务可用；抛错返回 500，便于监控判定「挂了」。
 */
export async function GET() {
  try {
    const payload = await getPayload({ config: configPromise })
    // 探一个真实集合，验证「Next + Payload + PostgreSQL」整条链路
    await payload.find({ collection: 'cards', limit: 1, overrideAccess: true })
    return NextResponse.json({ status: 'ok', time: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json(
      { status: 'error', error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
