import type { CollectionConfig } from 'payload'

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
  auth: true,
  // 受控后台账号模型（角色 / 首次强制改密 / 首用户即管理员）。
  // 设计见 docs/specs/2026-11-04-back-office-account-auth.md。
  // 注意：access 收紧必须与 role 字段同时上线，否则会锁死或更不安全。
  access: {
    // 本人或管理员可见
    read: ({ req, id }) => {
      if (req.user?.role === '管理员') return true
      return Boolean(id && req.user?.id === id)
    },
    // 仅管理员可创建；集合为空时放行首用户（钩子保证其为管理员，避免被冒领）
    create: async ({ req }) => {
      if (req.user?.role === '管理员') return true
      const { totalDocs } = await req.payload.count({ collection: 'users' })
      return totalDocs === 0
    },
    // 本人或管理员可改（role 另有字段级权限，普通用户无法自提权）
    update: ({ req, id }) => {
      if (req.user?.role === '管理员') return true
      return Boolean(id && req.user?.id === id)
    },
    // 仅管理员可删
    delete: ({ req }) => req.user?.role === '管理员',
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const isCreate = !originalDoc?.id
        // 首用户即管理员：集合为空时，无论调用方传什么角色都强制为管理员
        if (isCreate) {
          const { totalDocs } = await req.payload.count({ collection: 'users' })
          if (totalDocs === 0) data.role = '管理员'
          // 管理员新建的账号，默认强制下次登录改密
          if (req.user?.role === '管理员') data.forcePasswordChange = true
        }
        // 改密场景：管理员改他人密码 → 对方须改密；本人改密 → 清零
        if (data.password) {
          const isSelf = Boolean(req.user?.id) && originalDoc?.id === req.user?.id
          const isAdminChangingOther =
            req.user?.role === '管理员' && Boolean(originalDoc?.id) && originalDoc.id !== req.user.id
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
      type: 'select',
      label: { zh: '角色', en: 'Role', ja: '権限' },
      defaultValue: '普通用户',
      options: [
        { label: { zh: '管理员', en: 'Admin', ja: '管理者' }, value: '管理员' },
        { label: { zh: '普通用户', en: 'Operator', ja: '運営' }, value: '普通用户' },
      ],
      // 字段级权限：只有管理员能改角色，杜绝普通用户把自己的角色改成管理员（自提权）
      access: { update: ({ req }) => req.user?.role === '管理员' },
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
