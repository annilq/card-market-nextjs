import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// 修正 roles_permissions 数组表的列名：Payload 运行时实际期望 `_parent_id` 与 `_order`
// （带下划线前缀），而非裸 parent_id / order。该迁移对已应用上一版迁移的库做列重命名。
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'roles_permissions' AND column_name = 'parent_id'
      ) THEN
        ALTER TABLE "roles_permissions" RENAME COLUMN "parent_id" TO "_parent_id";
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'roles_permissions' AND column_name = 'order'
      ) THEN
        ALTER TABLE "roles_permissions" RENAME COLUMN "order" TO "_order";
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
        WHERE table_name = 'roles_permissions' AND column_name = '_parent_id'
      ) THEN
        ALTER TABLE "roles_permissions" RENAME COLUMN "_parent_id" TO "parent_id";
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'roles_permissions' AND column_name = '_order'
      ) THEN
        ALTER TABLE "roles_permissions" RENAME COLUMN "_order" TO "order";
      END IF;
    END $$;
  `)
}
