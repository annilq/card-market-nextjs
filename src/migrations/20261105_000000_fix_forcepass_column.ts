import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 修复 users 表 forcePasswordChange 列名。
 *
 * 上一版迁移（20261104_221900_role_phone_forcepass）用字面量
 * `ADD COLUMN "forcePasswordChange"` 建了一个 camelCase 的列，但 Payload 的
 * postgres adapter 按 snake_case 约定查询该字段，实际列名应为
 * `force_password_change`（与 reset_password_token / login_attempts / avatar_id 一致）。
 *
 * 后果：后台每次查 users 表都报
 * `column users.force_password_change does not exist`，SSR 抛错后浏览器侧落到
 * Next 的 error 边界，整个 /admin 进不去（React #441 同类问题）。
 *
 * 这里把现有列改名为约定名，幂等地修复已部署库；新库若走自动建表则本应直接是
 * snake_case，RENAME 在列不存在时安全跳过（用 IF EXISTS）。
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // RENAME COLUMN 不支持 IF EXISTS，用 DO 块做幂等判断：
  // 已部署库里是 camelCase 列，需要改名；全新库由 20261104 迁移直接建成
  // snake_case，此时 camelCase 不存在，跳过即可。
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'forcePasswordChange'
      ) THEN
        ALTER TABLE "users" RENAME COLUMN "forcePasswordChange" TO "force_password_change";
      END IF;
    END $$;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'force_password_change'
      ) THEN
        ALTER TABLE "users" RENAME COLUMN "force_password_change" TO "forcePasswordChange";
      END IF;
    END $$;
  `)
}
