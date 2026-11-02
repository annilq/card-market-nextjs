// 重置业务数据（保留表结构与管理员账号）：清空所有业务集合后重跑 seed。
import { Client } from 'pg'

const TABLES = [
  'messages',
  'cards_rels',
  'cards',
  'banners',
  'announcements',
  'info_pages',
  'shops',
  'info_pages',
  'sub_series',
  'series',
  'rarities',
  'ips',
  'media',
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
