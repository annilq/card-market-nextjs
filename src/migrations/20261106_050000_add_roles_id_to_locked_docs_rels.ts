import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Payload 的「文档锁定」功能（payload-locked-documents）会在
  // payload_locked_documents_rels 中为「每个可作为关系目标（relationTo）的集合」
  // 保留一列 <collection>_id。新增 roles 集合（见 020000 迁移）并通过
  // users.role 成为关系目标后，该内部表缺少 roles_id 列，导致后台任何
  // 加载锁定文档的查询都抛 `column payload_locked_documents__rels.roles_id
  // does not exist`。因为 push:false，必须手动补建该列，并补齐外键与索引，
  // 与 init 迁移中其它 *_id 列的写法保持一致。
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "roles_id" integer;

    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_roles_fk" FOREIGN KEY ("roles_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "payload_locked_documents_rels_roles_id_idx" ON "payload_locked_documents_rels" USING btree ("roles_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_roles_id_idx";

    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_roles_fk";

    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "roles_id";
  `)
}
