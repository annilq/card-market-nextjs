# 技术栈对比：Directus + TanStack Start vs Payload + Next.js

> 同一套业务（card-market）在两个栈上各实现一遍后的实测对比。
> 左：`/Users/annilq/Documents/develop/card-market`（Directus 11 + TanStack Start + Postgres）
> 右：`card-market-nextjs`（Payload 3 + Next.js 16 + Postgres，本仓库）
> 数据均为本机实测（MacBook / Postgres 17 / Node 24.2.0），仅作量级参考。

## 1. 一句话结论

**Payload 把「CMS」从「一个要单独部署的服务」变成了「项目里的一层代码」**：
少一个运行时、少一套部署、少一次网络往返、模型进 Git 可 review；
代价是**前端被绑死在 Next.js**（Payload 3 是 Next.js 原生），且**数据库层的特殊对象（如 GIN 索引）必须走迁移，不能手工建**。

如果团队已经用 Next.js，或者希望「模型、权限、迁移全部进版本管理」，Payload 更省事。
如果前端要保持框架自由（Vue / Svelte / 原生 App 共用一套 API），或者需要非技术同事在 UI 里建集合，Directus 更合适。

## 2. 工作量与产物（实测）

| 项 | Directus + TanStack | Payload + Next.js |
| --- | --- | --- |
| 运行时数量 | 2（前端 Node + Directus 容器） | 1（Next.js，后台与前台同源） |
| 业务代码量 | 前端 5,646 行 + 后端建模/种子脚本 1,579 行 ≈ **7,225 行** | **7,377 行**（含集合定义、权限、钩子、迁移、页面） |
| 建模方式 | `directus/bootstrap.mjs`（1,262 行幂等脚本，含大量 REST 调用与踩坑注释） | `src/collections/*.ts`（12 个文件，类型由 `payload generate:types` 产出） |
| 依赖安装 | 前端一套 + Directus 另起容器 | 553 个包，一次装完（本机 9 分钟，受网络影响） |
| 生产构建 | `vite build` | `next build`：编译 6.8s + TS 2.9s |
| 后台自定义组件 | 独立 Vue 扩展工程 + 构建产物 + 容器挂载 | 同仓库 React 组件（`MapPickerField`）+ `generate:importmap` 自动注册 |

「代码量相近」但**结构不同**：Directus 那 1,579 行里很大一部分是在跟运行时 API / M2M 元数据 / 外键搏斗；
Payload 这边这些变成了集合配置（`admin`、关系字段、`filterOptions`），由框架负责。

## 3. 性能（实测）

| 场景 | Directus + TanStack | Payload + Next.js |
| --- | --- | --- |
| 页面 SSR（生产，首页 / 列表 / 详情 / 门店） | dev 模式 35–102ms（生产未测） | **9–25ms**（冷启动首个请求 252ms） |
| 取一次卡牌列表（含关系展开） | REST 单次 7–25ms，且**每页需 5–6 次**（cards + 4 个维度 + site_settings） | Local API **4.36ms/次**（30 次均值），无网络开销 |
| 关键词查询（name/code like） | REST + `pg_trgm` | Local API **3.25ms/次**，同一套 `pg_trgm` GIN 索引 |

关键点不是「单次查询快多少」，而是**每页省掉 5–6 次跨进程 HTTP**，
并且 SSR 与取数在同一个进程、同一个连接池、不需要序列化/鉴权往返。

## 4. 开发体验对比（逐项）

| 维度 | Directus | Payload | 谁更省事 |
| --- | --- | --- | --- |
| 建模 | 脚本 REST 建集合 / 后台 UI 点击 | TS 配置文件 | Payload（可 diff、可 review、类型自动出） |
| 类型安全 | 手写 `src/lib/types.ts`，与后台字段靠约定同步 | `payload generate:types` 产出 `payload-types.ts`，字段改了类型就变 | Payload |
| 迁移 | 无迁移概念，靠脚本幂等重放；改字段容易留下脏状态 | `payload migrate:create` + `payload migrate`，SQL 进 Git | Payload |
| 权限 | 后台角色 + 脚本写权限；字段级权限要在 UI 里配 | 集合上的 access control **函数**（返回布尔或 Where 查询），可写测试 | Payload |
| 富文本 | Markdown/HTML 字符串 → `markdown-it` + `DOMPurify` | Lexical 结构化 JSON → 服务端转 HTML，无「管理员粘 script」这条路 | Payload |
| 后台自定义 UI | Vue 扩展工程，另构建、另挂载 | 同仓库 React 组件 | Payload |
| 组合唯一约束 | 手写 SQL 唯一索引（`bootstrap.mjs`） | 框架无原生支持 → `dedupeKey` 计算列 + `beforeValidate` 钩子 | 平手（都要绕） |
| 派生字段 | 数据库触发器（`trg_shops_sync_geo`） | `beforeChange` 钩子 | Payload |
| 前端框架 | 任意（本例 TanStack Start） | **只能 Next.js** | Directus |
| 非技术同事建集合 | 后台 UI 直接建 | 需要改代码 + 部署 | Directus |
| 多语言后台界面 | `directus_settings.default_language` + 集合/字段翻译 | `i18n.supportedLanguages` + `label: { zh, ja, en }` | 平手 |
| 图片存储 | S3 驱动（env 配置） | 默认本地磁盘；生产换 `@payloadcms/storage-s3`（env 配置） | 平手 |

## 5. 实测踩坑（Payload 侧，都是真遇到的）

1. **Leaflet 顶层 `import` 会打挂后台 SSR**——自定义字段组件会被打进服务端 bundle，
   Leaflet 在模块加载时摸 `window`，结果 `/admin` 500。改法：组件内 `await import('leaflet')`。
2. **dev 模式的 schema push 会 DROP 手工建的索引**：手建 `pg_trgm` GIN 索引后一重启就没了。
   改法：`postgresAdapter({ push: false })` + 把索引写进 `src/migrations/`。
   （这一条会让「顺手写个 SQL」的习惯失效，是 Payload 化最需要适应的地方。）
3. **`payload migrate` 在跑过 dev 之后会拦一道确认**（提示可能丢数），CI 里要用非交互方式处理。
4. **复合唯一约束没有原生方案**：用 `dedupeKey` 计算列 + 钩子显式报错，
   换来了「后台有可读中文报错」，但比一条 SQL 唯一索引啰嗦。
5. **生成类型名来自 slug**：`sub-series` → `SubSery`，`site-settings` → `SiteSetting`，命名要靠 `labels` 兜住可读性。
6. **Node 版本**：payload 3.92 要求 `^22.23.4 || >=24.22.1`，本机 24.2.0 会 EBADENGINE 警告（目前运行正常，但应升级）。
7. **Next 16 把 `middleware` 约定改名为 `proxy`**，现在是 deprecation 警告，迟早要迁。

Directus 侧的坑（原项目注释里已有）：M2M 的 `junction_field` 漏配会让后台按钮消失、
修关系不能用裸 `PATCH /relations`（会顺手删外键）、`select-dropdown-m2o` 写错就退化成手输主键。
这类坑**在 Payload 里不存在**，因为关系就是字段配置。

## 6. 部署方案

### 6.1 Payload + Next.js（本仓库）

因为后台与前台是同一个 Next.js 应用，**部署单元只有一个**。

**方案 A：单台 VPS + Docker Compose（推荐给客户自托管）**

```
[Caddy/Nginx :443]
   ├─ /api/*, /admin/*, 页面  →  app 容器（Next.js standalone，:3100）
   └─ 静态/图片缓存
                ↓
        postgres 容器（或托管 Postgres）+ 持久卷（上传目录）
```

- `docker build` 用 Next.js standalone 输出，镜像 ~200MB 级。
- 上传目录必须挂持久卷；多副本时要换成 S3（见下）。
- 上线步骤：`payload migrate` → 起容器 → 健康检查 `/api/users/me`（401 即健康）。
- 成本：1 台 2C4G VPS + 托管 PG，约 $20–40/月（日本/美国区）。

**方案 B：Vercel / Netlify（Serverless）**

```
Vercel（Next.js，含 /admin 与 /api） → Neon/Supabase Postgres（连接池）
                                    → S3/R2（必须，Serverless 文件系统是临时的）
```

- 必须装 `@payloadcms/storage-s3`，否则上传的图片会丢：
  ```ts
  // src/payload.config.ts
  import { s3Storage } from '@payloadcms/storage-s3'
  plugins: [
    s3Storage({
      collections: { media: { prefix: 'media' } },
      bucket: process.env.S3_BUCKET!,
      config: {
        endpoint: process.env.S3_ENDPOINT,     // R2: https://<acct>.r2.cloudflarestorage.com
        region: process.env.S3_REGION ?? 'auto',
        credentials: { accessKeyId: process.env.S3_KEY!, secretAccessKey: process.env.S3_SECRET! },
      },
    }),
  ]
  ```
- 注意 Serverless 的连接数：Postgres 必须走 **PgBouncer/连接池**（Next 每次调用可能新建连接）。
- 注意冷启动：Payload 初始化 + Drizzle schema 拉取有一次性开销。
- 成本：Vercel Pro $20/月起 + Neon $19/月起 + R2（几乎免费）。

**方案 C：Fly.io / Render（折中）**

- 常驻进程（不像 Serverless 那样丢文件系统），可以用本地卷存图；
- Fly 支持挂载卷 + 多区域（东京 `nrt` / 洛杉矶 `lax`），正好对上「日本 + 美国双区域」；
- Postgres 用 Fly PG 或托管，图片仍建议 S3/R2。

**已验证 / 未验证**（本机实测）：

- ✅ `next build` 通过，`output: 'standalone'` 产物 `node server.js` 直接起服务，
  `/`、`/cards`、`/announcements`、`/admin` 全部 200（即「不用 Docker 也能部署」这条路是通的）。
- ⚠ `Dockerfile` / `docker-compose.yml` 已写好，但**本机没拉取到 `node:24-slim` 基础镜像**
  （Docker Hub 在本环境不可达——原项目 README 里也记了同一个限制），所以镜像未经实跑验证。
  换一个能拉到基础镜像的环境（或用内网镜像仓库）即可。

### 6.2 Directus + TanStack Start（原项目）

**方案 A：单 VPS（Docker）**：Directus + Postgres + 前端 Node + Nginx，成本低但需自管备份/监控。
**方案 B：海外云拆分**：VPS/容器跑 Directus + 前端，托管 PG + R2/S3 + CDN。
**方案 C：托管 PaaS**：Render/Fly(Directus+PG) + Vercel/Netlify(前端)——TanStack Start 需要 Node adapter。

无论哪种，都要解决两件事：对象存储自定义域名 + HTTPS/CDN；Directus 与前端的 CORS / 反向代理。

### 6.3 部署复杂度对比

| 项 | Directus + TanStack | Payload + Next.js |
| --- | --- | --- |
| 需要部署的东西 | 3 个（Postgres、Directus、前端） | 2 个（Postgres、Next.js 应用） |
| 镜像 / 构建产物 | Directus 官方镜像 + 前端构建 + 扩展 dist | 一个 Next.js 镜像（扩展即源码，不用单独构建） |
| CORS / 跨域 | 要配（前端域名 → Directus 白名单） | 不需要（前台与 API 同源） |
| Serverless 可行性 | 前端可以，Directus 通常要常驻 | 可以，但上传必须外置 S3 |
| 环境变量 | 两套（前端 + Directus） | 一套 |
| 备份 | PG + 上传目录 + Directus schema snapshot | PG + 上传目录（schema 在代码里） |
| 水平扩展 | Directus 与前端分别扩 | 一个应用一起扩（本地磁盘需先换 S3） |

## 7. 选型建议

- **选 Payload**：团队已用 Next.js；希望模型/权限/迁移全部进 Git；想省掉一个运行时和跨域；后台定制愿意写 React。
- **选 Directus**：前端不想被 Next.js 绑住（或已有 Vue/其他框架）；非技术同事需要在 UI 里建集合改字段；多个客户端共用一套 API。
- **本项目（客户只有 1 名非技术运营者、内容模型已固定）**：两套都能满足。
  若交付后客户不会自己加集合，**Payload 的运维面更小**（一个进程、一套环境变量、无 CORS）；
  若客户以后可能自己加字段/集合，**Directus 的后台建模 UI 更友好**。

## 8. 复现命令

```bash
# 本仓库（Payload 版）
npm install && npm run payload migrate && npm run generate:types && npm run seed && npm run dev

# 实测数据来源
node --env-file=.env --import tsx scripts/bench.ts        # Local API 查询耗时
npm run build && npm run start                            # 生产构建与 SSR 耗时
```
