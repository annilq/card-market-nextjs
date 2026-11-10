import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** 卡牌新增「不减额买取」标记，与「高价买取」互斥。 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "cards" ADD COLUMN "is_no_deduction" boolean DEFAULT false;
    CREATE INDEX "cards_is_no_deduction_idx" ON "cards" USING btree ("is_no_deduction");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "cards_is_no_deduction_idx";
    ALTER TABLE "cards" DROP COLUMN IF EXISTS "is_no_deduction";
  `)
}
