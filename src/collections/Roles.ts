import type { CollectionConfig } from 'payload'

import { MODULE_OPTIONS, isRoleAdmin } from '@/access/roles'

/**
 * 角色管理（自定义角色 + 权限矩阵）。
 *
 *  - 仅管理员可增删改查角色本身；
 *  - 每个角色可勾选「能看哪些模块」以及每个模块的「新增 / 编辑 / 删除」操作；
 *  - isAdmin 为 true 时视为超级管理员，忽略权限矩阵、拥有全部模块全部操作；
 *  - 权限矩阵在用户为管理员以外的角色时生效。
 */
export const Roles: CollectionConfig = {
  slug: 'roles',
  labels: {
    plural: { zh: '角色管理', en: 'Roles', ja: 'ロール管理' },
    singular: { zh: '角色', en: 'Role', ja: 'ロール' },
  },
  admin: {
    defaultColumns: ['name', 'isAdmin', 'updatedAt'],
    description: {
      zh: '自定义后台角色及其模块权限',
      en: 'Custom admin roles and their module permissions',
      ja: '管理権限のカスタムロール',
    },
    group: { zh: '系统', en: 'System', ja: 'システム' },
    useAsTitle: 'name',
  },
  access: {
    create: ({ req }) => isRoleAdmin(req),
    delete: ({ req }) => isRoleAdmin(req),
    read: ({ req }) => isRoleAdmin(req),
    update: ({ req }) => isRoleAdmin(req),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: { zh: '角色名称', en: 'Role name', ja: 'ロール名' },
      required: true,
      unique: true,
    },
    {
      name: 'isAdmin',
      type: 'checkbox',
      label: { zh: '超级管理员（拥有全部权限）', en: 'Super admin (all permissions)', ja: '管理者（全権限）' },
      defaultValue: false,
      access: {
        read: ({ req }) => isRoleAdmin(req),
        update: ({ req }) => isRoleAdmin(req),
      },
      admin: {
        description: {
          zh: '勾选后该角色对所有模块拥有全部操作，权限矩阵不再生效。',
          en: 'Grants all permissions on every module; the matrix is ignored.',
          ja: '全モジュールの全権限を付与し、行列は無視されます。',
        },
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: { zh: '说明', en: 'Description', ja: '説明' },
    },
    {
      name: 'permissions',
      type: 'array',
      label: { zh: '模块权限', en: 'Module permissions', ja: 'モジュール権限' },
      admin: {
        condition: (data) => !data?.isAdmin,
        description: {
          zh: '超级管理员无需配置此矩阵；仅对普通角色生效。',
          en: 'Only applies to non-admin roles.',
          ja: '管理者以外のロールにのみ適用されます。',
        },
      },
      fields: [
        {
          name: 'module',
          type: 'select',
          label: { zh: '模块', en: 'Module', ja: 'モジュール' },
          options: MODULE_OPTIONS,
          required: true,
        },
        {
          name: 'view',
          type: 'checkbox',
          label: { zh: '查看', en: 'View', ja: '閲覧' },
          defaultValue: false,
        },
        {
          name: 'create',
          type: 'checkbox',
          label: { zh: '新增', en: 'Create', ja: '作成' },
          defaultValue: false,
        },
        {
          name: 'update',
          type: 'checkbox',
          label: { zh: '编辑', en: 'Edit', ja: '編集' },
          defaultValue: false,
        },
        {
          name: 'delete',
          type: 'checkbox',
          label: { zh: '删除', en: 'Delete', ja: '削除' },
          defaultValue: false,
        },
      ],
    },
  ],
}
