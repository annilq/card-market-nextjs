import type { Access, FieldAccess, Where } from 'payload'

/** 管理员（已登录后台用户）拥有全部权限。 */
export const isAdmin: Access = ({ req }) => Boolean(req.user)

/** 只写不读：公开可 create，但读取必须登录（留言集合用）。 */
export const adminOnlyRead: Access = ({ req }) => Boolean(req.user)

/**
 * 内容集合的公开读：未登录访客只能看到 status=published 的记录。
 * 返回 Where 查询而不是 false，是为了让「过滤」发生在数据库层（分页总数也正确）。
 */
export const publishedOnly: Access = ({ req }) => {
  if (req.user) return true
  const where: Where = { status: { equals: 'published' } }
  return where
}

/** 维度集合（ips/series/sub-series/rarities/card-statuses）用布尔 enabled 控制是否启用。 */
export const enabledOnly: Access = ({ req }) => {
  if (req.user) return true
  const where: Where = { enabled: { equals: true } }
  return where
}

/**
 * 公告的公开读：status=published 且 (published_at 为空 或 <= 现在)。
 * 空值用 exists:false 表达（Payload 的 Where 会把未设置/空日期匹配出来）。
 */
export const publishedAnnouncementOnly: Access = ({ req }) => {
  if (req.user) return true
  const where: Where = {
    and: [
      { status: { equals: 'published' } },
      {
        or: [
          { publishedAt: { less_than_equal: new Date().toISOString() } },
          { publishedAt: { exists: false } },
        ],
      },
    ],
  }
  return where
}

/** 公开可创建留言（REST）；后台登录用户可全量操作。 */
export const publicCreateAdminRest: Access = ({ req }) => Boolean(req.user)

/** 字段级：status 只允许后台用户修改。 */
export const adminOnlyField: FieldAccess = ({ req }) => Boolean(req.user)
