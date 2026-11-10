import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 卡牌状态从固定枚举（raw / packaged）改成指向 card-statuses 的关系。
 *
 * 与 init 迁移里 rarities 的落地规则一致：
 *   - 关系字段（hasMany: false）在主表加 <字段>_id 列 + 外键 + 索引；
 *   - 每个可作为关系目标的集合在 payload_locked_documents_rels 里保留一列 <集合>_id；
 *   - 角色权限矩阵的 module 是独立的 ENUM 类型，新增模块要补一个枚举值。
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "card_statuses" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "sort" numeric DEFAULT 0,
      "enabled" boolean DEFAULT true,
      "accent" boolean DEFAULT false,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- 存量卡牌的两个旧枚举值落成两条可编辑的状态记录；accent 保留原「有包装」的强调样式。
    INSERT INTO "card_statuses" ("name", "sort", "enabled", "accent", "updated_at", "created_at")
    VALUES ('裸卡', 1, true, false, now(), now()), ('有包装', 2, true, true, now(), now());

    ALTER TABLE "cards" ADD COLUMN "card_status_id" integer;

    UPDATE "cards" SET "card_status_id" = s."id"
    FROM "card_statuses" s
    WHERE s."name" = CASE "cards"."card_status"::text WHEN 'packaged' THEN '有包装' ELSE '裸卡' END;

    -- 兜底：异常枚举值也归到「裸卡」，避免 SET NOT NULL 失败。
    UPDATE "cards" SET "card_status_id" = (SELECT "id" FROM "card_statuses" WHERE "name" = '裸卡' LIMIT 1)
    WHERE "card_status_id" IS NULL;

    ALTER TABLE "cards" ALTER COLUMN "card_status_id" SET NOT NULL;
    ALTER TABLE "cards" DROP COLUMN "card_status";
    DROP TYPE "public"."enum_cards_card_status";

    ALTER TABLE "cards" ADD CONSTRAINT "cards_card_status_id_card_statuses_id_fk" FOREIGN KEY ("card_status_id") REFERENCES "public"."card_statuses"("id") ON DELETE set null ON UPDATE no action;

    CREATE INDEX "card_statuses_name_idx" ON "card_statuses" USING btree ("name");
    CREATE INDEX "card_statuses_updated_at_idx" ON "card_statuses" USING btree ("updated_at");
    CREATE INDEX "card_statuses_created_at_idx" ON "card_statuses" USING btree ("created_at");
    CREATE INDEX "cards_card_status_idx" ON "cards" USING btree ("card_status_id");

    -- 新增模块要进角色权限矩阵的枚举；PG 12+ 允许在事务内 ADD VALUE，本迁移不再写入该值。
    ALTER TYPE "public"."enum_roles_permissions_module" ADD VALUE IF NOT EXISTS 'card-statuses';

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "card_statuses_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_card_statuses_fk" FOREIGN KEY ("card_statuses_id") REFERENCES "public"."card_statuses"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_card_statuses_id_idx" ON "payload_locked_documents_rels" USING btree ("card_statuses_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_card_statuses_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_card_statuses_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "card_statuses_id";

    ALTER TABLE "cards" DROP CONSTRAINT IF EXISTS "cards_card_status_id_card_statuses_id_fk";
    DROP INDEX IF EXISTS "cards_card_status_idx";

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'enum_cards_card_status' AND n.nspname = 'public'
      ) THEN
        CREATE TYPE "public"."enum_cards_card_status" AS ENUM('raw', 'packaged');
      END IF;
    END $$;

    ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "card_status" "public"."enum_cards_card_status" DEFAULT 'raw' NOT NULL;
    UPDATE "cards" SET "card_status" = 'packaged'
    WHERE "card_status_id" IN (SELECT "id" FROM "card_statuses" WHERE "accent" = true);
    ALTER TABLE "cards" DROP COLUMN IF EXISTS "card_status_id";

    DROP INDEX IF EXISTS "card_statuses_name_idx";
    DROP INDEX IF EXISTS "card_statuses_updated_at_idx";
    DROP INDEX IF EXISTS "card_statuses_created_at_idx";
    DROP TABLE IF EXISTS "card_statuses" CASCADE;

    -- PG 的 ENUM 不支持 DROP VALUE，'card-statuses' 会留在 enum_roles_permissions_module 里。
    -- 它不再被任何角色引用，回滚后只需保证权限矩阵不写入这个值即可。
  `)
}
