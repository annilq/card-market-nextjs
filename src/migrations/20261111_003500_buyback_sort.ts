import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** 卡牌新增买取排序号，供首页「高价买取」栏目排序。 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "cards" ADD COLUMN "sort" numeric;
    CREATE INDEX "cards_sort_idx" ON "cards" USING btree ("sort");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "cards_sort_idx";
    ALTER TABLE "cards" DROP COLUMN IF EXISTS "sort";
  `)
}
