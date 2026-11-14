import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * 卡牌状态新增显式颜色，移除「高亮标识」。
 *
 * 之前前台按状态名称正则匹配三种颜色（PSA 红 / 裸卡蓝 / 包装绿），新增状态或
 * 改名都会意外换色。现在颜色是 card-statuses 的 select 字段，前端只读这个值。
 *
 * 存量数据按旧规则回填，保证上线瞬间视觉不变：
 *   - 勾过 accent（原「有包装」）或名称命中包装关键词 → 绿
 *   - 名称命中裸卡 / 单卡关键词 → 蓝
 *   - 其余 → 红（字段默认值）
 *
 * accent 列不再被模型引用，直接删除；回滚时按绿色状态还原成 accent=true。
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_card_statuses_color" AS ENUM('red', 'blue', 'green', 'amber', 'violet', 'slate');

    ALTER TABLE "card_statuses"
      ADD COLUMN "color" "enum_card_statuses_color" DEFAULT 'red' NOT NULL;

    UPDATE "card_statuses" SET "color" = 'green'
    WHERE "accent" = true OR "name" ~* 'BOX|PACK|SEAL|包装|未開封|未开封';

    UPDATE "card_statuses" SET "color" = 'blue'
    WHERE "name" ~* '裸|RAW|BARE|SINGLE|未鑑定|未鉴定';

    ALTER TABLE "card_statuses" DROP COLUMN "accent";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "card_statuses" ADD COLUMN "accent" boolean DEFAULT false;

    UPDATE "card_statuses" SET "accent" = true WHERE "color" = 'green';

    ALTER TABLE "card_statuses" DROP COLUMN "color";
    DROP TYPE IF EXISTS "public"."enum_card_statuses_color";
  `)
}
