// 临时性能测量脚本：直接调用 Payload Local API，复刻各页面真实发起的查询，
// 量化「每次查询的数据库往返耗时」以及减少 depth / 加缓存后的收益。
// 仅读取，不写入。运行：DATABASE_URI=... node --env-file=.env --import tsx scripts/measure-perf.ts
import configPromise from '../src/payload.config'
import { getPayload, type Payload } from 'payload'

const ITER = 5

async function time(label: string, fn: () => Promise<unknown>, n = ITER) {
  // 预热 1 次（吞掉首次连接的额外开销单独由 init 体现）
  await fn()
  const start = performance.now()
  for (let i = 0; i < n; i++) await fn()
  const avg = (performance.now() - start) / n
  console.log(`  ${label.padEnd(34)} ${avg.toFixed(1)} ms/次`)
  return avg
}

async function main() {
  const t0 = performance.now()
  const payload: Payload = await getPayload({ config: configPromise })
  const init = performance.now() - t0
  console.log(`Payload 初始化（连库 + 建 schema）: ${init.toFixed(0)} ms\n`)

  console.log('— 单次查询耗时（depth 2 → depth 1 对比）—')
  const cardsD2 = await time('cards.find depth=2 (列表默认)', () =>
    payload.find({ collection: 'cards', depth: 2, overrideAccess: false, limit: 24 }),
  )
  const cardsD1 = await time('cards.find depth=1 (优化后)', () =>
    payload.find({ collection: 'cards', depth: 1, overrideAccess: false, limit: 24 }),
  )
  await time('cards.find depth=0 (仅 ID)', () =>
    payload.find({ collection: 'cards', depth: 0, overrideAccess: false, limit: 24 }),
  )
  await time('cards.find depth=2 + like 搜索', () =>
    payload.find({
      collection: 'cards',
      depth: 2,
      overrideAccess: false,
      limit: 24,
      where: { or: [{ name: { like: '皮卡' } }, { code: { like: '197' } }] },
    }),
  )

  console.log('\n— 各页面额外查询（depth 如上）—')
  await time('site-settings findGlobal depth=2', () =>
    payload.findGlobal({ slug: 'site-settings', depth: 2, overrideAccess: false }),
  )
  await time('site-settings findGlobal depth=1', () =>
    payload.findGlobal({ slug: 'site-settings', depth: 1, overrideAccess: false }),
  )
  await time('banners.find depth=1', () =>
    payload.find({ collection: 'banners', depth: 1, overrideAccess: false, limit: 20 }),
  )
  await time('announcements.find depth=1', () =>
    payload.find({ collection: 'announcements', depth: 1, overrideAccess: false, limit: 4, sort: '-publishedAt' }),
  )
  // facets：4 个并行查询，测整体耗时
  const facetStart = performance.now()
  for (let i = 0; i < ITER; i++) {
    await Promise.all([
      payload.find({ collection: 'ips', depth: 0, overrideAccess: false, limit: 200 }),
      payload.find({ collection: 'series', depth: 0, overrideAccess: false, limit: 500 }),
      payload.find({ collection: 'sub-series', depth: 0, overrideAccess: false, limit: 1000 }),
      payload.find({ collection: 'rarities', depth: 0, overrideAccess: false, limit: 200 }),
    ])
  }
  console.log(`  ${'facets (4 并行) 整体'.padEnd(34)} ${((performance.now() - facetStart) / ITER).toFixed(1)} ms/次`)

  console.log('\n— 每页「数据库查询」耗时估算（当前 depth=2，无缓存）—')
  // 首页：banners(1) + announcements(1) + getHighValueCards→cards(1) + facets(4 并行≈1) + getCards(1) + layout site-settings(1) + metadata site-settings(1)
  const perPage = (label: string, queries: number[]) => {
    const sum = queries.reduce((a, b) => a + b, 0)
    console.log(`  ${label.padEnd(22)} ≈ ${sum.toFixed(0)} ms  （含 ${queries.length} 次查询）`)
  }
  perPage('首页 /', [cardsD2, cardsD2, cardsD2, cardsD2, cardsD2, cardsD2]) // 近似：多段各一次 find
  perPage('/cards 列表', [cardsD2, cardsD2, cardsD2, cardsD2, cardsD2]) // cards + facets(≈1) + settings×2

  console.log('\n说明：以上为纯数据库往返耗时（含 Neon 跨区延迟）。每次页面导航都会重新支付这笔代价，')
  console.log('因为当前没有任何缓存、且 Payload 客户端每次请求都重新初始化（见 src/lib/payload.ts 的 React.cache）。')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
