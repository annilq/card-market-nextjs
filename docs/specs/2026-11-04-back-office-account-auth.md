# Spec: 后台账号受控生命周期（角色 / 首次强制改密 / 管理员重置）

> 术语遵循本仓库 `GLOSSARY.md`：后台运营账号统称为「后台账号」，是 Payload 中的一个**集合**（即 `users` 集合）；运营是使用该集合的人。本规格不引入新的账号模型，而是在该集合上扩展。

## Problem Statement

当前后台账号系统的行为，和运营期望的受控流程对不上，而且存在安全问题：

- **没有角色区分**：`users` 集合只有 `name`/`avatar`，没有管理员 / 普通用户的区分，所有登录用户权限相同。
- **越权漏洞（已存在）**：集合的 `update` 访问规则是「只要登录就能改」，意味着任意运营可以修改**任何**账号——包括改别人的密码和角色。这是当前最危险的问题。
- **自助找回密码发不出去**：没接邮件适配器，登录页「忘记密码」点了只会把邮件打到服务器控制台，真实用户收不到，等于功能坏掉。
- **没有首次强制改密**：管理员创建账号设的初始密码会被一直使用，没有机制逼用户改成自己的。
- **首用户不是管理员**这份契约没有用代码锁死，后续注册有被冒领管理员的风险。

运营想要的流程是：第一个账号是管理员 → 之后只能由管理员新建账号并设初始密码 → 普通用户首次登录被强制改密 → 忘记密码只能找管理员重置。这样非管理员无法重置他人密码，所有重置都由管理员经手、可追溯、无风险。

## Solution

在现有的**后台账号集合**上扩展，而不是新建账号模型：

1. 增加 `role` 字段（管理员 / 普通用户），并对该字段加「仅管理员可改」的字段级权限，杜绝自提权。
2. 增加 `forcePasswordChange` 标记：管理员新建的账号默认置真，登录后必须由本人改密后才清零。
3. 收紧集合的 `access`：`read`/`update` 仅本人或管理员；`create`/`delete` 仅管理员（集合为空时允许创建首用户例外）。这同时修掉上面的越权洞。
4. 关闭自助找回密码（`forgotPassword: false`），让「重置密码」只剩管理员在后台改这一条路——既满足受控，也顺带消解了邮件发不出去的问题。
5. 首用户即管理员：集合为空时，首个被创建的账号强制为管理员（`beforeChange` 钩子保证）。
6. 客户端强制改密守卫：挂在后台全局 providers 里的小组件，读当前运营者的 `forcePasswordChange`，为真时弹出**遮罩式**强制改密模态框，点完才能进工作区。
7. （可选）审计：新增审计集合 + 钩子，记录「谁在何时改了谁的密码/角色」。

## User Stories

1. As the very first operator, I want to create the initial account through the first-user setup, so that I become the administrator.
2. As an administrator, I want to create a back-office account for a new operator, so that they can access the panel.
3. As an administrator, I want to set an initial password when creating an account, so that the new user has a known starting credential.
4. As an administrator, I want the new account to be flagged for mandatory password change, so that the operator must set their own secret on first login.
5. As a new operator, I want to be blocked by a modal prompting me to change my password on first login, so that I am not left using the admin-assigned temporary password.
6. As a new operator, I want the administrator's initial password to be invalidated once I set my own, so that the temporary credential cannot be reused.
7. As an operator, I want to change my own password from my account area, so that I can keep my credential secure.
8. As an operator, I want to update my own profile (name, avatar), so that my account reflects me.
9. As a non-admin operator, I want to be prevented from viewing or editing other operators' accounts, so that I cannot tamper with colleagues.
10. As a non-admin operator, I want to be prevented from changing any role (including promoting myself to admin), so that privileges cannot be escalated.
11. As an administrator, I want to assign the admin or operator role when creating or editing an account, so that privileges are explicit.
12. As an administrator, I want to reset a colleague's password when they forget it, so that they can regain access without a self-service email.
13. As an operator who forgot my password, I want a clear controlled path: ask the administrator, who resets it, so that I am not blocked and the reset is administered.
14. As any operator, I want the login page to NOT offer self-service "forgot password", so that only administrators can reset passwords.
15. As an administrator, I want accounts to lock after several failed login attempts, so that brute-force is slowed.
16. As an administrator, I want the first-user setup to auto-grant admin only when zero accounts exist, so that later signups cannot claim admin.
17. As an administrator, I want the "create account" action hidden from non-admins in the navigation/toolbar, so that only admins can provision users.
18. As an operator, I want my password change to take effect immediately and the forced-change flag cleared, so that I am not prompted again.
19. As an administrator, I want an audit record of who changed whose password/role and when (optional), so that all resets are traceable.
20. As an operator, I want my uploaded avatar to still display in the header regardless of password state, so that identity stays consistent.

## Implementation Decisions

- **扩展现有后台账号集合，不新建账号模型。** 后台面板只能由单一 auth 集合（`admin.user`）认证；按 `GLOSSARY.md`，后台账号本就是集合。若未来出现 C 端买家/卖家自助注册，那是独立 auth 域（独立集合 + 独立公开登录），不在本规格内。
- **`role` 字段**：枚举（管理员 / 普通用户），默认「普通用户」；字段级 `update` 权限仅管理员——防止普通用户把自己的角色改成管理员。
- **`forcePasswordChange` 字段**：布尔，后台 UI 隐藏，管理员新建账号时默认真；本人成功改密后清零。
- **收紧 `access`**（随 `role` 一起落地，二者不可拆开）：
  - `read`：本人 或 管理员；
  - `update`：本人 或 管理员（且角色字段仍受字段级权限约束）；
  - `create` / `delete`：仅管理员，但 `create` 在「集合为空」时放行（用于首用户）；
  - 这修掉当前「任意登录用户可改任意账号」的越权洞。
- **关闭自助找回密码**：`forgotPassword: false`，删除登录页「忘记密码」入口；唯一重置路径是管理员在后台改该账号密码。不再依赖邮件适配器。
- **首用户即管理员**：`beforeChange` 钩子——当集合计数为 0 时，强制 `role = 管理员`；同时，当管理员修改了某个**他人**的密码时，重新置 `forcePasswordChange = true`，让对方下次登录必须再设新密码。
- **客户端强制改密守卫**：挂在后台全局 providers 组件里的小组件，读 auth 上下文中的 `forcePasswordChange`，为真时渲染**遮罩式**强制改密模态框，提交走账号更新接口（本人 `update` 允许），成功后清零标记。默认采用遮罩必改（更安全的选项）；非遮罩的顶部横幅提醒作为备选，但本规格以遮罩为准。
- **登录限流**：启用失败尝试次数与锁定时长（auth 自带能力），降低爆破风险。
- **头像与密码解耦**：既有的头像上传 / 顶栏头像展示保持不变，密码状态不影响头像显示。
- **复用既有挂载点**：强制改密守卫挂进现有的后台全局 providers（既有接缝），不新造 provider 树。

## Testing Decisions

- **主接缝：后台账号集合配置**——它的 `access` 函数与 `beforeChange` 钩子。它们是作用于「模拟请求/操作上下文」的纯函数，无需 UI 或真实数据库即可完整单元测试。这是覆盖「谁能读/建/改/删/重置」这一安全关键行为的最高、最单一接缝。
- **次接缝：认证配置行为**——验证「忘记密码」接口确实缺席/禁用、登录锁定阈值生效，通过 auth 的 REST 表面来验证。
- **三级接缝：强制改密守卫组件**——用模拟 auth 上下文渲染；断言 `forcePasswordChange` 为真时遮罩出现、成功改密后消失。保持轻量，因为它只是已测逻辑之上的展示层。
- **好的测试只断言外部行为**（给定角色 + 目标，能否执行某动作、是否被拒），不测实现细节。先验：仓库内既有的集合 `access` 函数与钩子是可直接参照的模式，测试应放在集合同侧。
- **可选 API 级测试**：用管理员 / 普通用户 token 打 users 接口，确认该 403 的地方返回 403。

## Out of Scope

- C 端客户账号 / 公开自助注册：那是独立 auth 域（独立集合 + 独立公开登录），不属于本规格。
- 邮件适配器配置 / 品牌化找回邮件（本规格有意用「管理员重置」替代自助邮件）。
- SSO / 社交登录 / MFA。
- 超出 auth 自带能力的密码强度策略（可作为后续）。
- 审计集合：除非明确要，否则列为可选。

## Further Notes

- **必须先一起落地**：`access` 收紧与 `role` 字段必须同时上线；只上其一会让系统更糟或不可用。当前 `update: ({ req }) => Boolean(req.user)` 是活跃的安全洞，应随本规格一并修复。
- **术语对齐**：按 `GLOSSARY.md`，后台账号是集合，本规格保持在既有集合扩展，与该词汇表一致。
- **首用户管理员**：Payload 在集合为空时本就显示「创建首个用户」表单；钩子保证该账号为管理员。
- **关闭 `forgotPassword` 的副作用**：重置不再需要邮件适配器，也顺手解决了之前「重置邮件打到控制台」的问题。
- **两个未决项已按合理默认收口**：① 后台账号（非 C 端）已由词汇表确认；② 强制改密默认采用遮罩必改（顶部横幅为备选）。若与预期不符，可在评审时调整。
