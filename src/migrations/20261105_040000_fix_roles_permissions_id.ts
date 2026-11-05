import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// 修正 roles_permissions 的 id 列类型：数组子表的 id 由 Payload 生成 CUID 字符串，
// 因此是 varchar（不是 serial 整数）。对已经按 serial 建表的库做一次类型转换。
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'roles_permissions' AND column_name = 'id' AND data_type <> 'character varying'
      ) THEN
        ALTER TABLE "roles_permissions" ALTER COLUMN "id" DROP DEFAULT;
        ALTER TABLE "roles_permissions" ALTER COLUMN "id" TYPE varchar USING "id"::varchar;
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
        WHERE table_name = 'roles_permissions' AND column_name = 'id' AND data_type = 'character varying'
      ) THEN
        -- 仅在子表无数据（CUID 无法转回整数）时安全回退；正式库回滚此纠错迁移前应确保 roles_permissions 为空。
        ALTER TABLE "roles_permissions" ALTER COLUMN "id" TYPE integer USING "id"::integer;
        ALTER TABLE "roles_permissions" ALTER COLUMN "id" ADD DEFAULT nextval('roles_permissions_id_seq');
      END IF;
    END $$;
  `)
}
