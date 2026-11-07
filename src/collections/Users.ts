import type { CollectionConfig } from 'payload'

import { ensureAdminRole, isRoleAdmin, roleFieldUpdateOnlyAdmin } from '@/access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: { zh: '用户', en: 'User', ja: 'ユーザー' }, plural: { zh: '用户', en: 'Users', ja: 'ユーザー' } },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role'],
    group: { zh: '系统', en: 'System', ja: 'システム' },
  },
  // 让「Users」集合支持登录鉴权（邮箱 + 密码）。
  // 注意：本 Payload 版本（3.92.x）的 auth.forgotPassword 是「配置对象」而非布尔，
  // 且登录页「忘记密码」入口无条件渲染、无配置开关可关 —— 因此自助找回密码不走
  // `forgotPassword: false`，而是 (a) 不接邮件适配器使其本就发不出邮件（功能实质失效），
  // (b) 用 admin-ui.css 把登录页那个入口隐藏。唯一可取的重置路径 = 管理员后台改密
  // （access 已收紧 + beforeChange 钩子把对方标记为需改密）。见 spec。
  //
  // 登录态用纯 JWT（useSessions:false）。
  // self-hosted standalone 下 useSessions:true 时，Payload 每次鉴权都会校验 JWT 里的
  // sid 必须存在于该用户的 sessions（users_sessions 关系表）中（见 payload 的
  // auth/strategies/jwt.js）；实测本项目登录成功后该校验仍不通过 → /admin 一律 307
  // 跳回 /admin/login（表现即「登录成功却进不去」）。关掉 session 后不再走该校验，
  // 用户声明直接装进 payload-token cookie，登录链路闭环。
  // 代价：不能服务端单独吊销某次登录，只能等 token 过期（tokenExpiration 秒）。
  // secure:false 适配当前明文 HTTP（VPS 直连 :3100）；上 HTTPS 后改回 true。
  auth: {
    useSessions: false,
    tokenExpiration: 7200,
    cookies: { sameSite: 'Lax', secure: false },
  },
  // 受控后台账号模型（角色 / 首次强制改密 / 首用户即管理员）。
  // 设计见 docs/specs/2026-11-04-back-office-account-auth.md。
  // 注意：access 收紧必须与 role 字段同时上线，否则会锁死或更不安全。
  // role 现在是「角色」集合的关系字段（而非写死的 管理员/普通用户 下拉）：
  //   - 管理员是 roles 里一条 isAdmin=true 的特殊记录；
  //   - 普通角色来自角色管理（自定义 + 权限矩阵）；
  //   - 新建用户时 filterOptions 过滤掉管理员角色，只能选已添加的普通角色；
  //   - 角色字段仅管理员可改（字段级访问），杜绝普通用户自提权。
  access: {
    // 本人或管理员可见
    read: async ({ req, id }) => {
      if (await isRoleAdmin(req)) return true
      return Boolean(id && req.user?.id === id)
    },
    // 仅管理员可创建；集合为空时放行首用户（钩子保证其为管理员，避免被冒领）
    create: async ({ req }) => {
      if (await isRoleAdmin(req)) return true
      const { totalDocs } = await req.payload.count({ collection: 'users' })
      return totalDocs === 0
    },
    // 本人或管理员可改（role 另有字段级权限，普通用户无法自提权）
    update: async ({ req, id }) => {
      if (await isRoleAdmin(req)) return true
      return Boolean(id && req.user?.id === id)
    },
    // 仅管理员可删
    delete: ({ req }) => isRoleAdmin(req),
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const isCreate = !originalDoc?.id
        // 首用户即管理员：集合为空时，确保存在「管理员」角色并强制绑定，
        // 避免被冒领（首用户引导期间 filterOptions 放开，也能在 UI 选到）。
        if (isCreate) {
          const { totalDocs } = await req.payload.count({ collection: 'users' })
          if (totalDocs === 0) data.role = await ensureAdminRole(req)
          // 管理员新建的账号，默认强制下次登录改密
          if (await isRoleAdmin(req)) data.forcePasswordChange = true
        }
        // 改密场景：管理员改他人密码 → 对方须改密；本人改密 → 清零
        if (data.password) {
          const isSelf = Boolean(req.user?.id) && String(originalDoc?.id) === String(req.user?.id)
          const isAdminChangingOther =
            (await isRoleAdmin(req)) && Boolean(originalDoc?.id) && String(originalDoc?.id) !== String(req.user?.id)
          if (isAdminChangingOther) data.forcePasswordChange = true
          else if (isSelf) data.forcePasswordChange = false
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', label: { zh: '姓名', en: 'Name', ja: '名前' } },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      label: { zh: '头像', en: 'Avatar', ja: 'アイコン' },
      // 让运营能在「账户」页上传自己的头像；后台右上角的账户图标（admin.avatar）
      // 会优先显示这张图，加载失败再退回首字母 / 默认人形图标，绝不出现裂图。
    },
    {
      name: 'phone',
      type: 'text',
      label: { zh: '电话', en: 'Phone', ja: '電話' },
      // 后台运营账号的电话：用于联系 / 2FA / 短信验证；可选，非收货信息。
    },
    {
      name: 'role',
      type: 'relationship',
      relationTo: 'roles',
      label: { zh: '角色', en: 'Role', ja: '権限' },
      required: true,
      hasMany: false,
      // 新建用户（无 id）时过滤掉「管理员」角色，只能选已添加的普通角色；
      // 首用户引导（集合为空）放开，否则无法把首用户设为管理员；
      // 编辑已有用户（有 id）放开，允许管理员保持 / 调整对方角色。
      filterOptions: async ({ req, id }) => {
        if (id) return true
        const { totalDocs } = await req.payload.count({ collection: 'users' })
        if (totalDocs === 0) return true
        return { isAdmin: { equals: false } }
      },
      // 字段级权限：只有管理员能改角色，杜绝普通用户把自己的角色改成管理员（自提权）
      access: {
        update: roleFieldUpdateOnlyAdmin,
      },
    },
    {
      name: 'forcePasswordChange',
      type: 'checkbox',
      label: { zh: '首次登录强制改密', en: 'Force password change', ja: '初回パスワード変更必須' },
      defaultValue: false,
      admin: { hidden: true }, // 后台 UI 不显示；由钩子控制，客户端守卫读取
    },
  ],
}
