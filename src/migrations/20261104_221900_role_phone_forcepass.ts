import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // 后台账号新增字段：电话 / 角色 / 首次强制改密
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN "phone" varchar;
    ALTER TABLE "users" ADD COLUMN "role" varchar DEFAULT '普通用户';
    ALTER TABLE "users" ADD COLUMN "force_password_change" boolean DEFAULT false;
  `)
  // 迁移前已存在的账号一律保留管理员身份，避免被默认「普通用户」降权后锁死后台。
  // 之后可由管理员在后台按需把多余账号降为普通用户。
  await db.execute(sql`UPDATE "users" SET "role" = '管理员' WHERE "role" = '普通用户'`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN "phone";
    ALTER TABLE "users" DROP COLUMN "role";
    ALTER TABLE "users" DROP COLUMN "force_password_change";
  `)
}
