import configPromise from '../src/payload.config'
import { getPayload } from 'payload'

const payload = await getPayload({ config: configPromise })
const t0 = performance.now()
await payload.find({ collection: 'cards', limit: 24, overrideAccess: false, depth: 2 })
const t1 = performance.now()
for (let i = 0; i < 30; i++) {
  await payload.find({ collection: 'cards', limit: 24, overrideAccess: false, depth: 2 })
}
const t2 = performance.now()
console.log(`Local API 首次查询: ${(t1 - t0).toFixed(1)}ms / 之后 30 次均值: ${((t2 - t1) / 30).toFixed(2)}ms`)

const t3 = performance.now()
for (let i = 0; i < 30; i++) {
  await payload.find({ collection: 'cards', limit: 24, overrideAccess: false, depth: 2, where: { or: [{ name: { like: '皮卡' } }, { code: { like: '197' } }] } })
}
console.log(`关键词查询（like，30 次均值）: ${((performance.now() - t3) / 30).toFixed(2)}ms`)
process.exit(0)
