/**
 * 角色与权限的集中定义 + 访问助手。
 *
 * 设计（与用户确认）：
 *  - 「管理员」是 roles 集合里一条带 isAdmin 开关的特殊记录；
 *  - 普通角色（如「运营」）通过 permissions 矩阵声明「能看哪些模块、每个模块能做什么操作」；
 *  - 管理员角色默认拥有全部模块的全部操作（isAdmin 短路返回 true）；
 *  - 媒体（media）也纳入权限矩阵，但匿名访客（前台）始终可读，仅对登录用户按角色控制，
 *    这样公开站点的图片不会因权限而裂图。
 *
 * 性能：resolveUserRole 会按请求缓存（挂载在 req 上），一次 HTTP 请求内只查一次 roles。
 * 前台用的是无用户的服务端读取（overrideAccess:false），那里 req.user 为空，
 * 直接走各集合的「匿名公开 Where」，不会触发角色查询。
 */
import type { Access, FieldAccess, PayloadRequest } from 'payload'
import type { Role, User } from '@/payload-types'

/**
 * 可授权的模块清单（角色权限矩阵的「行」）。
 * 不含 users / roles 自身——用户与角色管理始终仅管理员可操作。
 */
export const MODULES = [
  { slug: 'announcements', label: { zh: '公告', en: 'Announcements', ja: 'お知らせ' } },
  { slug: 'banners', label: { zh: '首页轮播', en: 'Banners', ja: 'バナー' } },
  { slug: 'cards', label: { zh: '卡牌', en: 'Cards', ja: 'カード' } },
  { slug: 'info-pages', label: { zh: '信息页', en: 'Info pages', ja: '情報ページ' } },
  { slug: 'ips', label: { zh: 'IP / 大类', en: 'IPs', ja: 'IP' } },
  { slug: 'series', label: { zh: '系列', en: 'Series', ja: 'シリーズ' } },
  { slug: 'sub-series', label: { zh: '子系列', en: 'Sub-series', ja: 'サブシリーズ' } },
  { slug: 'rarities', label: { zh: '稀有度', en: 'Rarities', ja: 'レアリティ' } },
  { slug: 'shops', label: { zh: '门店', en: 'Shops', ja: '店舗' } },
  { slug: 'messages', label: { zh: '访客留言', en: 'Messages', ja: 'お問い合わせ' } },
  { slug: 'media', label: { zh: '媒体素材', en: 'Media', ja: 'メディア' } },
  { slug: 'site-settings', label: { zh: '站点设置', en: 'Site settings', ja: 'サイト設定' } },
] as const

export type ModuleSlug = (typeof MODULES)[number]['slug']

export const MODULE_OPTIONS = MODULES.map((m) => ({ label: m.label, value: m.slug }))

function toRoleId(role: Role | number | string | null | undefined): number | string | null {
  if (role == null) return null
  if (typeof role === 'object') return (role as Role).id ?? null
  return role
}

/**
 * 解析当前登录用户的角色文档（带请求级缓存）。
 * 使用 overrideAccess 直接查库，避免与 roles 集合自身的访问规则相互递归。
 */
export async function resolveUserRole(req: PayloadRequest): Promise<Role | null> {
  const user = req.user as (User & { role?: Role | number | string | null }) | undefined
  if (!user || user.role == null) return null

  const cached = (req as unknown as Record<string, unknown>).__roleDoc
  if (cached !== undefined) return cached as Role | null

  const roleId = toRoleId(user.role)
  let role: Role | null = null
  if (roleId != null) {
    try {
      role = (await req.payload.findByID({
        collection: 'roles',
        id: roleId,
        overrideAccess: true,
        depth: 0,
      })) as Role
    } catch {
      role = null
    }
  }
  ;(req as unknown as Record<string, unknown>).__roleDoc = role
  return role
}

/** 当前用户是否为「管理员」角色（拥有全部权限）。匿名用户一律 false。 */
export async function isRoleAdmin(req: PayloadRequest): Promise<boolean> {
  if (!req.user) return false
  const role = await resolveUserRole(req)
  return Boolean(role?.isAdmin)
}

/**
 * 确保「管理员」角色存在（首用户引导 / 种子用）：查不到就创建一个。
 * 返回管理员角色的 id。overrideAccess 操作，不依赖任何权限。
 */
export async function ensureAdminRole(req: PayloadRequest): Promise<number | string | null> {
  const existing = await req.payload.find({
    collection: 'roles',
    overrideAccess: true,
    where: { isAdmin: { equals: true } },
    limit: 1,
  })
  if (existing.docs.length > 0) return existing.docs[0].id
  const created = await req.payload.create({
    collection: 'roles',
    overrideAccess: true,
    data: { name: '管理员', isAdmin: true },
  })
  return created.id
}

type PermissionAction = 'create' | 'delete' | 'update' | 'view'

/**
 * 模块「查看」权限。
 *  - 匿名访客：走各集合自己的公开只读 Where（保持前台公开读取）。
 *  - 登录管理员：全部可见。
 *  - 登录普通角色：取决于该角色是否勾选了对应模块的「查看」。
 * 返回 false 时 Payload 会自动把该模块从后台导航隐藏（只读不显示）。
 */
export function moduleRead(module: ModuleSlug, anonRead: Access): Access {
  return async (args) => {
    const { req } = args
    if (!req.user) return anonRead(args)
    const role = await resolveUserRole(req)
    if (role?.isAdmin) return true
    if (!role) return false
    const perm = findPermission(role, module)
    return Boolean(perm?.view)
  }
}

/**
 * 模块「新增 / 编辑 / 删除」权限。
 *  - 匿名访客：一律 false（写操作必须登录）。
 *  - 登录管理员：全部允许。
 *  - 登录普通角色：取决于该角色对应模块的勾选。
 */
export function roleAction(module: ModuleSlug, action: Exclude<PermissionAction, 'view'>): Access {
  return async ({ req }) => {
    if (!req.user) return false
    const role = await resolveUserRole(req)
    if (role?.isAdmin) return true
    if (!role) return false
    const perm = findPermission(role, module)
    if (!perm) return false
    return Boolean(perm[action])
  }
}

function findPermission(role: Role, module: ModuleSlug) {
  return (role.permissions ?? []).find((p) => p.module === module)
}

/**
 * 字段级访问：某模块某操作是否允许（管理员恒真）。
 * 用于「某字段仅拥有该模块编辑权限的角色可改」这类字段级控制（如留言处理状态）。
 */
export function roleActionField(
  module: ModuleSlug,
  action: Exclude<PermissionAction, 'view'>,
): FieldAccess {
  return async ({ req }) => {
    if (await isRoleAdmin(req)) return true
    if (!req.user) return false
    const role = await resolveUserRole(req)
    const perm = role ? findPermission(role, module) : undefined
    return Boolean(perm?.[action])
  }
}

/**
 * 字段级访问：仅管理员可改「角色」字段，防止普通用户自我提权。
 */
export const roleFieldUpdateOnlyAdmin: FieldAccess = ({ req }) => isRoleAdmin(req)
