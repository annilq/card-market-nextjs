import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 中文子串搜索索引。
 *
 * 为什么必须写成迁移而不是一条一次性 SQL：Payload 会用 Drizzle 的 schema 做同步，
 * 不在它模型里的索引会被下一次 schema 同步「顺手」删掉（实测：手动 CREATE INDEX 后
 * 重启服务就被 DROP 了）。放进迁移链，索引才跟着代码一起进版本管理。
 *
 * 已知边界：pg_trgm 需要模式里至少能抽出三元组，两三个汉字的关键词（如「皮卡」）
 * 仍然会退化成顺序扫描——中文场景若要覆盖 2 字查询，应改用 pg_bigm（bigm 扩展）
 * 或上层加全文检索（tsvector）。这一点与 Directus 版完全一致，不是 Payload 特有。
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE INDEX IF NOT EXISTS "cards_name_trgm_idx" ON "cards" USING gin ("name" gin_trgm_ops);
   CREATE INDEX IF NOT EXISTS "cards_code_trgm_idx" ON "cards" USING gin ("code" gin_trgm_ops);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "cards_name_trgm_idx";
   DROP INDEX IF EXISTS "cards_code_trgm_idx";
  `)
}
