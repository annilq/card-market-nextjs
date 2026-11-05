import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 兜底修复 users 表，使 schema 收敛到 Payload 期望的最终形态。本迁移对「全新库」和
 * 「已踩中旧 bug 的库」都安全（幂等），具体处理两类偏差：
 *
 *   1. forcePasswordChange -> force_password_change
 *      旧版 20261104 迁移曾用 camelCase 字面量建列，但 Payload 按 snake_case 约定
 *      查询，导致后台查 users 表报 "column users.force_password_change does not exist"，
 *      SSR 抛错后浏览器落到 Next error 边界，整个 /admin 进不去（React #441 同类问题）。
 *
 *   2. role 列类型 varchar -> enum_users_role
 *      旧版 20261104 把 role 建成了普通 varchar，但 Payload 为 select 字段生成的是
 *      独立 ENUM 类型（enum_<collection>_<field>，参照 init 里的 enum_cards_card_status）。
 *      类型不符同样会让 Payload 在读写 users 时 schema 校验失败、后台进不去。
 *
 * 用 information_schema 存在性判断做幂等：全新库已经是正确的 snake_case + enum，
 * 不会触发任何 ALTER；已踩中 bug 的库则被修正到一致状态。
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      -- 确保 ENUM 类型存在
      IF NOT EXISTS (
        SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'enum_users_role' AND n.nspname = 'public'
      ) THEN
        CREATE TYPE "public"."enum_users_role" AS ENUM('管理员', '普通用户');
      END IF;

      -- role：若为 varchar（旧 bug）则转成 enum；若缺失则补建
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'role' AND data_type = 'character varying'
      ) THEN
        ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."enum_users_role"
          USING "role"::"public"."enum_users_role";
      ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'role'
      ) THEN
        ALTER TABLE "users" ADD COLUMN "role" "public"."enum_users_role" DEFAULT '普通用户';
      END IF;

      -- force_password_change：旧 camelCase 改名；缺失则补建
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'forcePasswordChange'
      ) THEN
        ALTER TABLE "users" RENAME COLUMN "forcePasswordChange" TO "force_password_change";
      ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'force_password_change'
      ) THEN
        ALTER TABLE "users" ADD COLUMN "force_password_change" boolean DEFAULT false;
      END IF;

      -- phone：缺失则补建
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'phone'
      ) THEN
        ALTER TABLE "users" ADD COLUMN "phone" varchar;
      END IF;
    END $$;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // 尽力回滚：把 force_password_change 还原回 camelCase（仅当 snake_case 存在且
  // camelCase 不存在时），与「旧 bug」状态对齐。role 的 enum 类型改动不在回滚范围内。
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'force_password_change'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'forcePasswordChange'
      ) THEN
        ALTER TABLE "users" RENAME COLUMN "force_password_change" TO "forcePasswordChange";
      END IF;
    END $$;
  `)
}
