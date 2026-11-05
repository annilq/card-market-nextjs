import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // 新增「角色」集合（含权限矩阵数组字段 roles_permissions）。
  // 注意：Payload 的 postgres adapter 约定 ——
  //   - 数组字段落地为 <集合>_<字段> 表，含 id / order / parent_id（外键回主表）+ 各子字段列；
  //   - select 字段落地为独立的 ENUM 类型；
  //   - 关系字段（relationTo: 'roles', hasMany: false）在主表加 <字段>_id 列 + 外键。
  await db.execute(sql`
    CREATE TYPE "public"."enum_roles_permissions_module" AS ENUM(
      'announcements', 'banners', 'cards', 'info-pages', 'ips',
      'series', 'sub-series', 'rarities', 'shops', 'messages', 'media', 'site-settings'
    );

    CREATE TABLE "roles" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "is_admin" boolean DEFAULT false,
      "description" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX "roles_name_unique" ON "roles" USING btree ("name");

    CREATE TABLE "roles_permissions" (
      "id" varchar PRIMARY KEY NOT NULL,
      "_order" integer,
      "_parent_id" integer NOT NULL,
      "module" "public"."enum_roles_permissions_module",
      "view" boolean DEFAULT false,
      "create" boolean DEFAULT false,
      "update" boolean DEFAULT false,
      "delete" boolean DEFAULT false,
      CONSTRAINT "roles_permissions__parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action
    );

    -- users.role 由「枚举 select 列」改为「指向 roles 的关系列」
    ALTER TABLE "users" ADD COLUMN "role_id" integer;
    ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE set null ON UPDATE no action;

    -- 数据：保证存在管理员角色，并把存量用户全部归入管理员（避免后台锁死）。
    DO $$
    DECLARE admin_id integer;
    BEGIN
      INSERT INTO "roles" ("name", "is_admin", "created_at", "updated_at")
      SELECT '管理员', true, now(), now()
      WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "is_admin" = true);
      SELECT id INTO admin_id FROM "roles" WHERE "is_admin" = true LIMIT 1;
      UPDATE "users" SET "role_id" = admin_id WHERE "role_id" IS NULL;
    END $$;

    -- 移除旧的枚举角色列（来自 20261104_221900_role_phone_forcepass 迁移）
    ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
    DROP TYPE IF EXISTS "public"."enum_users_role";
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "role_id";
    DROP TABLE IF EXISTS "roles_permissions";
    DROP TABLE IF EXISTS "roles";
    DROP TYPE IF EXISTS "public"."enum_roles_permissions_module";

    -- 还原旧的角色枚举列（保持与 20261104_221900_role_phone_forcepass 一致）
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'enum_users_role' AND n.nspname = 'public'
      ) THEN
        CREATE TYPE "public"."enum_users_role" AS ENUM('管理员', '普通用户');
      END IF;
    END $$;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "public"."enum_users_role" DEFAULT '普通用户';
  `)
}
