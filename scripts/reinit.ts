// 重置业务数据（保留表结构与管理员账号）：清空所有业务集合后重跑 seed。
import { Client } from 'pg'

// 业务数据 + 管理员 + 角色全部清空，保留表结构。
// 各集合的 *_rels 关联表由 RESTART IDENTITY CASCADE 自动级联清空，无需逐个列出。
// payload 系统表（payload_migrations / payload_preferences / _locales 等）不动。
const TABLES = [
  'messages',
  'cards',
  'banners',
  'announcements',
  'info_pages',
  'shops',
  'sub_series',
  'series',
  'rarities',
  'ips',
  'media',
  'roles',
  'users',
]

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URI })
  await client.connect()
  await client.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`)
  await client.end()
  console.log(`✅ 已清空：${TABLES.join(', ')}`)
}

main().catch((error) => {
  console.error('❌ reset 失败：', error)
  process.exit(1)
})
