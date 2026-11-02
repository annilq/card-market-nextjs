// 中文子串模糊搜索的索引：Payload 的 `like` 在 Postgres 上是 ILIKE '%q%'，
// 默认走全表扫描。这里补 pg_trgm GIN 索引，让它命中索引（Directus 版本在 bootstrap 里建同样的索引）。
import { Client } from 'pg'

const STATEMENTS = [
  'CREATE EXTENSION IF NOT EXISTS pg_trgm',
  "CREATE INDEX IF NOT EXISTS cards_name_trgm_idx ON cards USING gin (name gin_trgm_ops)",
  "CREATE INDEX IF NOT EXISTS cards_code_trgm_idx ON cards USING gin (code gin_trgm_ops)",
]

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URI })
  await client.connect()
  for (const sql of STATEMENTS) {
    await client.query(sql)
    console.log('· 已执行：', sql)
  }
  await client.end()
  console.log('✅ 搜索索引就绪（pg_trgm GIN）')
}

main().catch((error) => {
  console.error('❌ 建索引失败：', error)
  process.exit(1)
})
