import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // 后台账号新增字段：电话 / 角色 / 首次强制改密。
  // 注意 Payload 的 postgres adapter 约定：
  //   1) 字段名 camelCase -> 列名 snake_case（forcePasswordChange -> force_password_change），
  //      与 reset_password_token / login_attempts / avatar_id 一致；
  //   2) select 字段落地为独立的 ENUM 类型（参照 init 迁移里的 enum_cards_card_status），
  //      因此 role 列类型必须是 enum_users_role，而不是普通 varchar。
  // 用 IF NOT EXISTS / CREATE TYPE IF NOT EXISTS 保证可重复执行（幂等）。
  await db.execute(sql`
    DO $$
    BEGIN
      -- CREATE TYPE 不支持 IF NOT EXISTS，用 pg_type 存在性判断做幂等
      IF NOT EXISTS (
        SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'enum_users_role' AND n.nspname = 'public'
      ) THEN
        CREATE TYPE "public"."enum_users_role" AS ENUM('管理员', '普通用户');
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone'
      ) THEN
        ALTER TABLE "users" ADD COLUMN "phone" varchar;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role'
      ) THEN
        -- 与 Payload 对「带 defaultValue 但非 required 的 select 字段」生成的 DDL 保持一致：
        -- 列可空（DB 层 default '普通用户' 兜底），不强制 NOT NULL。
        ALTER TABLE "users" ADD COLUMN "role" "public"."enum_users_role" DEFAULT '普通用户';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'force_password_change'
      ) THEN
        ALTER TABLE "users" ADD COLUMN "force_password_change" boolean DEFAULT false;
      END IF;
    END $$;
  `)
  // 迁移前已存在的账号一律保留管理员身份，避免被默认「普通用户」降权后锁死后台。
  // 之后可由管理员在后台按需把多余账号降为普通用户。
  await db.execute(sql`UPDATE "users" SET "role" = '管理员' WHERE "role" = '普通用户'`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "phone";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "force_password_change";
    DROP TYPE IF EXISTS "public"."enum_users_role";
  `)
}
