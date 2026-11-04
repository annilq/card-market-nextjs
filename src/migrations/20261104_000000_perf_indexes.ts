import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 性能索引补齐。
 *
 * `cards.price` / `is_high_value` / `status` / `created_at` 的索引已在初始迁移里存在，
 * 这里只补 `announcements.published_at`——前台 `getAnnouncements` 按 `-publishedAt` 排序，
 * 量上来后没有索引会退化成顺序扫描。其余筛选/排序列已覆盖，无需重复建。
 *
 * 同样放进迁移链（而非一次性 SQL）：Payload 的 schema 同步会清掉不在模型里的索引，
 * 见 20261101_080000_search_indexes.ts 的注释。
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE INDEX IF NOT EXISTS "announcements_published_at_idx" ON "announcements" ("published_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "announcements_published_at_idx";
  `)
}
