import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * 公告发布时间回填。
 *
 * 旧数据允许 status=published 且 published_at 为空（「发布即展示」），前台因此
 * 没有日期可渲染。新逻辑在发布时由 beforeChange 自动写入当前时间；这里把历史
 * 已发布公告补成 created_at —— 它们创建时即对外可见，创建时间就是实际发布时间。
 *
 * 草稿 / 归档不补：它们尚未（或不再）对外发布，等状态切到 published 时钩子会写入。
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "announcements"
    SET "published_at" = "created_at"
    WHERE "status" = 'published' AND "published_at" IS NULL
  `)
}

/** 数据回填无法可靠回滚（无法区分原本为空与本就等于 created_at 的记录），故不做事。 */
export async function down(_args: MigrateDownArgs): Promise<void> {
  // no-op
}
