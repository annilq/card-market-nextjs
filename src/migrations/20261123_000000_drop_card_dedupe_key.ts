import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * 1. 卡牌「编号」不再做唯一限制，移除组合唯一计算列及其唯一索引。
 * 2. 三个买取标记改为互斥：历史数据里同时勾了「停止买取」和另两个标记的卡，
 *    保留「停止买取」（停收是实际生效的状态），清掉买取等级标记。
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "cards_dedupe_key_idx";
    ALTER TABLE "cards" DROP COLUMN IF EXISTS "dedupe_key";
    UPDATE "cards"
    SET "is_high_value" = false, "is_no_deduction" = false
    WHERE "stop_buyback" = true AND ("is_high_value" = true OR "is_no_deduction" = true);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "dedupe_key" varchar;
    CREATE UNIQUE INDEX IF NOT EXISTS "cards_dedupe_key_idx" ON "cards" USING btree ("dedupe_key");
  `)
}
