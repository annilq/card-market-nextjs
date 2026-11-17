import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "sub_series" ADD COLUMN "ip_id" integer;
    UPDATE "sub_series" s SET "ip_id" = sr."ip_id" FROM "series" sr WHERE sr."id" = s."series_id";
    UPDATE "sub_series" SET "ip_id" = (SELECT "id" FROM "ips" ORDER BY "id" LIMIT 1) WHERE "ip_id" IS NULL;
    ALTER TABLE "sub_series" ALTER COLUMN "ip_id" SET NOT NULL;
    CREATE INDEX "sub_series_ip_idx" ON "sub_series" USING btree ("ip_id");
    ALTER TABLE "sub_series" ADD CONSTRAINT "sub_series_ip_id_ips_id_fk"
      FOREIGN KEY ("ip_id") REFERENCES "public"."ips"("id") ON DELETE set null ON UPDATE no action;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "sub_series" DROP CONSTRAINT IF EXISTS "sub_series_ip_id_ips_id_fk";
    DROP INDEX IF EXISTS "sub_series_ip_idx";
    ALTER TABLE "sub_series" DROP COLUMN IF EXISTS "ip_id";
  `)
}
