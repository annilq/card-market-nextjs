import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "cards" ADD COLUMN "stop_buyback" boolean DEFAULT false;
    CREATE INDEX "cards_stop_buyback_idx" ON "cards" USING btree ("stop_buyback");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "cards_stop_buyback_idx";
    ALTER TABLE "cards" DROP COLUMN IF EXISTS "stop_buyback";
  `)
}
