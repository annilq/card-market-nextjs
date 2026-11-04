# 部署到 Vercel 注意事项

本文记录把本项目（Next.js 16 + Payload 3 + PostgreSQL）部署到 Vercel 时的**必填项**与**踩过的坑**。
本地 `npm run dev` 正常，但部署后访问报 500 / 类型检查失败，几乎都源于「本地 `.env` 与 Vercel 环境变量是两套、互不同步」。下面逐条对照。

---

## 0. 前置：数据库与文件存储选型

- **数据库**：Vercel 上选 **Vercel Postgres**（本质就是 Neon）。
  ⚠️ 点「Add Postgres」后，Vercel **自动注入**的是 `POSTGRES_URL` / `DATABASE_URL` / `PGHOST`、`PGUSER`、`PGPASSWORD`、`PGDATABASE` 这一串（见 `.env` 里 Vercel 给的模板块），
  但本项目 `payload.config.ts` 的 `db` 适配器读的是 `process.env.DATABASE_URI`（第 84 行）。
  **自动注入的变量名对不上，等于没有数据库配置**。所以必须手动再在 Vercel 里加一条 `DATABASE_URI` = 那个 Neon 连接串（带 `?sslmode=require`）。
  > 本地之所以不用 `DATABASE_URI` 也能跑，是因为 `pg` 在 `connectionString` 为空时会回退读 `PG*` 环境变量（`.env` 模板里正好有）。Vercel 上这条回退救不活——你得显式补 `DATABASE_URI`。
- **文件存储**：Vercel 的磁盘是临时的（函数实例销毁后本地 `media/` 里的图就没了），**不能走本地磁盘**。
  本项目 `payload.config.ts` 里 `s3Storage` 分支在 `S3_BUCKET` 有值时自动激活，所以二选一：
  - **S3 兼容**（R2 / AWS S3 / Backblaze B2 / MinIO）：只填 `S3_*` 五个变量，无需改代码（本文默认此路，已用 B2）。
  - **Vercel Blob**：需额外装 `@payloadcms/storage-vercel-blob` 并改 `payload.config.ts`，token 由 Vercel 自动注入。

---

## 1. Vercel 环境变量清单（缺一不可）

在 **项目 → Settings → Environment Variables** 添加，Production / Preview / Development 三套都勾上：

| 变量 | 必填 | 说明 / 来源 |
|---|---|---|
| `DATABASE_URI` | ✅ | Vercel Postgres 的连接串（带 `?sslmode=require`）。代码读的就是它，**不是** `POSTGRES_URL` |
| `PAYLOAD_SECRET` | ✅ | **随机长字符串**（`openssl rand -base64 32` 生成）。⚠️ 见第 3 节，漏了会整页 500 |
| `SITE_URL` | ⬜ 可选 | **线上无需设置**。代码在 `VERCEL=1` 时把 `serverURL` 留空、改用请求 host（见坑 7），任意域名/preview 自动正确。仅当你想覆盖默认行为时才设。本地 dev 用不到它（`.env` 的 `NEXT_PUBLIC_SITE_URL` 兜 localhost） |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | ✅ | `zh` |
| `S3_BUCKET` | ✅（用 S3 时） | 桶名 |
| `S3_ENDPOINT` | ✅ | **必须带 `https://` 前缀**，如 `https://s3.us-west-004.backblazeb2.com` |
| `S3_REGION` | ✅ | 真实区域，**不能是 `auto`**（B2 不接受），如 `us-west-004` |
| `S3_KEY` | ✅ | B2 的 `applicationKeyId` |
| `S3_SECRET` | ✅ | B2 的 `applicationKey` |
| `NEXT_PUBLIC_SENTRY_DSN` | 推荐 | 本项目 Sentry 项目 `card-market-nextjs` 的 DSN |
| `SENTRY_ORG` | 推荐 | `koduckya` |
| `SENTRY_PROJECT` | 推荐 | `card-market-nextjs` |
| `SENTRY_AUTH_TOKEN` | 可选 | 仅构建期上传 source map 需要；不填则生产堆栈是压缩后的 |

> `.env` 与 Vercel 环境变量是**两套独立配置**。本地 `.env` 里的 `PAYLOAD_SECRET` / `DATABASE_URI` 不会自动同步到 Vercel，必须手动在控制台各加一遍。

---

## 2. 构建脚本（已修，勿回退）

`package.json` 的 `build` 已设为：

```json
"build": "payload generate:types && next build"
```

**原因**：`src/payload-types.ts` 被 `.gitignore` 忽略、不进 Git，Vercel 拉代码后缺这个文件，
会导致 `import ... from '@/payload-types'` 报 `Cannot find module`，并连锁引发 `seed.ts` / `data.ts` 的
`string | number → number` 类型错误，`next build` 的 tsc 阶段直接失败（报错 `Failed to type check`）。
改为构建前先 `payload generate:types` 生成类型，问题解决。

⚠️ 不要改回纯 `next build`；也不要把 `payload-types.ts` 提交进 Git（会和 schema 漂移）。

---

## 3. 坑位清单（按出现频率）

### 坑 0：`DATABASE_URI` 变量名对不上 → 连不上库（最隐蔽）
- **现象**：`GET /` 或 `GET /api/health` 返回 500；`payload.config.ts` 的 `db` 初始化报错（连接串为空）。
- **根因**：Vercel「Add Postgres」自动注入的是 `POSTGRES_URL` / `DATABASE_URL` / `PG*`，
  **不是**本项目读的那个 `DATABASE_URI`（`payload.config.ts:84`）。
  本地 `.env` 里也确实没有 `DATABASE_URI`——本地能跑只是因为 `pg` 在 `connectionString` 为空时会回退到 `PG*` 变量，
  而 Vercel 这个回退救不活。
- **修法**：在 Vercel 手动加一条 `DATABASE_URI` = Neon 连接串（带 `?sslmode=require`），三套环境都勾上，重新部署。
- **排查技巧**：若怀疑变量没生效，可临时在 `payload.config.ts` 里 `console.log('DB_URI=', process.env.DATABASE_URI)` 然后看 Vercel 构建/函数日志，确认拿到的是非空串再删掉 log。

### 坑 1：`PAYLOAD_SECRET` 漏设 → 整页 500（最常见）
- **现象**：`GET /` 返回 500，浏览器控制台有 `Minified React error #441`（这是服务端渲染抛异常后，客户端对失败响应的二次反应，不是根因）。
- **根因**：`payload.config.ts` 里 `secret: process.env.PAYLOAD_SECRET ?? ''`。Vercel 没设时变成空串，Payload 初始化直接抛错，首页 5 个数据函数（`getBanners` / `getAnnouncements` / `getHighValueCards` / `getFacets` / `getCards`）全走 `getPayloadClient()`，于是一渲染首页就 500。
- **修法**：Vercel 加 `PAYLOAD_SECRET`（随机长串），重新部署。
- **注意**：该值用于会话/令牌签名，设定后**不要随意改**——改了会让已有后台登录会话失效（需重新登录），数据本身不受影响。

### 坑 2：`S3_ENDPOINT` 缺 `https://` / `S3_REGION` 写成 `auto`
- **现象**：后台上传图片失败或图片 URL 无法访问。
- **根因**：`s3Storage` 的 `endpoint` 需要完整 URL；B2 的区域不是 `auto`，必须是 `s3.<区域>.backblazeb2.com` 里的那段（如 `us-west-004`）。
- **修法**：见第 1 节变量表。

### 坑 3：图片 401 / 403 —— 不要用「公开桶」，用「私有桶 + 签名下载」
本项目 `s3Storage` **同时开了 `clientUploads: true` 和 `signedDownloads: true`**：
- `clientUploads`：浏览器直传桶（绕开 Vercel 4.5MB 请求体上限）。
- `signedDownloads`：读图时由 `/api/media/file/<filename>` 路由**服务端签发临时签名 URL 并 302 重定向**给浏览器。

⚠️ **不要为了显示图片把 B2 桶设为 Public**：很多地区/账户把桶设公开时会强制要求绑定信用卡做身份校验——
本项目当初就是为「免信用卡」才选 B2 的，走公开桶正好和它的目标冲突。真相是：
**浏览器能加载图片 ≠ 桶要公开**。私有桶 + 签名下载（本项目的默认做法）完全不需要信用卡、也不需要公开。

需要桶侧做的只有两件事：
- **桶保持 Private**（默认就是，不要点 Public / 不要写 `allPublic:true`，否则反而触发绑卡）。
- **CORS Rules**：`clientUploads` 浏览器直传必须跨域放行（否则大图上传被浏览器拦），允许你的域名：
  ```json
  [
    {
      "corsRuleName": "card-market",
      "allowedOrigins": ["https://你的域名.vercel.app"],
      "allowedOperations": ["GET", "PUT", "POST", "HEAD"],
      "allowedHeaders": ["*"],
      "exposeHeaders": ["ETag"],
      "maxAgeSeconds": 3600
    }
  ]
  ```
  生产后把 `http://localhost:3100` 去掉，只留真实域名。

> 副作用：每次图片请求 Serverless 多一次签名运算（图带强缓存，影响极小）。`clientUploads` 直传本身也是签名 URL，不受影响。
> 注意 `media` 文档的 `url` 字段要指向 **Next.js 路由** `/api/media/file/<filename>?prefix=media`（由 `afterRead` 钩子生成），
> 而不是 B2 直链——后者在私有桶下会 401。改了 bucket 配置后重跑一次 seed 或按本坑修复脚本回写 url。

### 坑 4：开了 `clientUploads` 却没跑 S3 的 schema 迁移 → `column "prefix" does not exist`
- **现象**：首页 / `/cards` 返回 500，Sentry 里的真实错误是
  `Failed query: select ... "prefix", "_objectkey", ... from "media" ... error: column "prefix" does not exist`。
  浏览器看到的 `Minified React error #441` 只是这个服务端异常的二次反应，不是根因。
- **根因**：开 `clientUploads: true`（`payload.config.ts` 的 `s3Storage`）后，S3 插件会给 `media` 集合注入 `prefix` / `_objectkey` 两个字段。
  本项目 `db` 设了 `push: false`（不自动改表），而 `src/migrations/20261101_071941_init.ts` 是在**开 S3 之前**生成的，表里没有这两列。
  于是任何读取 media 的查询在 `from "media"` 时直接报缺列。
- **修法**（已生成好迁移文件，待执行）：
  ```bash
  # 需要 DATABASE_URI 带 sslmode=require（.env 里的 DATABASE_URI 是空的，pg 会回退到 PG*，但 migrate 更严格要 ssl）
  DATABASE_URI='postgresql://<user>:<pass>@<host>/<db>?sslmode=require' npx payload migrate
  ```
  这次生成的迁移是 `src/migrations/20261103_154633.ts`（只 `ADD COLUMN "prefix"` 与 `ADD COLUMN "_objectkey"`，安全、可逆）。
- **注意**：Sentry 里这条 error 标的是 `environment: development` / `localhost:3100`——因为本地 `.env` 的 `PG*` 也指向同一个 Neon 库，
  **本地 dev 和 Vercel 共用同一数据库**。所以修一次 schema，两边一起好，不用在 Vercel 控制台再跑一遍。

### 坑 5：`next.config.mjs` 的 `output: 'standalone'` 在 Vercel 被忽略
- 该选项是给 Docker 单机部署用的（见 README 的 Docker 段）。Vercel 用自己的运行时，**会忽略它**，无副作用，但别指望它在 Vercel 上生效。

### 坑 6：Next 16 弃用 `middleware.ts`
- 构建日志会警告 `The "middleware" file convention is deprecated. Please use "proxy" instead.`。
- 本项目路由依赖 middleware 做语言段 rewrite（`/` → `/zh`）和设置 `x-locale` 头。目前在 Next 16 上仍可用（仅警告），但**未来升级可能移除**。届时需把 `src/middleware.ts` 迁移成 `src/proxy.ts`（matcher 逻辑可平移）。留意升级时不要只因为这条警告就删掉 middleware，否则 `/` 会 404。

### 坑 7：`serverURL`（站点域名）配错 → 图片 localhost / 后台打不开
`serverURL` 同时影响两件事：
1. Payload 的 `url` 字段 `afterRead` 钩子用它把相对路径 `/api/media/file/<filename>?prefix=media` 拼成**图片绝对 URL**；
2. `/admin` 后台加载自身资源（JS/CSS）和调接口时的**主机基址**。

#### 最终解法（已写入代码）：线上 `serverURL` 留空，走「请求 host」
Vercel 注入 `VERCEL=1` 时，`payload.config.ts` 刻意把 `serverURL` 设成**空串**。
源码验证（`node_modules/payload/dist/utilities/formatAdminURL.js`）：当 `serverURL` 为空时，URL 直接返回**相对路径**，
admin 前端和媒体 URL 都按「用户实际访问的域名」（`window.location.origin` / 服务端 `req.headers.host`）同源解析。
于是无论访问主域名、部署专属域名还是 preview，**后台都不会再去一个不匹配的 host 拉资源**——空白/跨域问题从根上消失，
而且**线上不再需要配置任何「站点域名」变量**（Vercel 现在也不让新建 `NEXT_PUBLIC_` 变量，正好契合）。

本地 dev 时 `VERCEL` 未注入，`serverURL` 回退 `localhost:3100`，保证本地 SSR 的媒体绝对 URL 正确：
```
serverURL =
  VERCEL === '1' ? ''
  : SITE_URL || NEXT_PUBLIC_SITE_URL || 'http://localhost:3100'
```

前台 canonical / OG / `metadataBase` 同理统一走 `src/lib/site-url.ts` 的 `getOrigin()`（读 `x-forwarded-host`/`host`），
不再硬编码 localhost，线上自动用请求域名。

#### 7a. 历史坑：线上图片 URL 变成 `localhost`（图片侧）
- **现象**：页面能开，但 `<img>` 的 src 是 `http://localhost:3100/api/media/file/...`，外网访问不到。
- **根因**（已修复）：历史上 `serverURL` 解析成 localhost（没配域名变量 / 误用 `VERCEL_URL` 兜底）。
  现在线上 `serverURL` 留空 → 相对路径，本坑不再出现。

#### 7b. 历史坑：后台 `/admin` 打不开（后台侧，更隐蔽）
- **现象**：图片能正常显示（302 到 B2 签名 URL，主机无关），但访问 `https://<你的域名>/admin` 时后台空白/跨域。
- **根因**（已修复）：`serverURL` 指向了一个**和用户访问域名不是同一个 host** 的值——最典型就是旧代码的 `VERCEL_URL` 兜底：
  `VERCEL_URL` 是 Vercel **每次部署专属域名**（形如 `card-market-nextjs-6bvpqrk94-annilqs-projects.vercel.app`），
  与访问的主域名 `card-market-nextjs.vercel.app` **不匹配**，于是图能用（主机无关）但后台崩（主机相关）。
- **修法**（已写入代码）：线上 `serverURL` 留空 + 请求 host，见本坑开头。切勿再加 `VERCEL_URL` 兜底。

> ⚠️ **关于 `NEXT_PUBLIC_` 变量**：Vercel 现在不允许新建 `NEXT_PUBLIC_` 前缀的环境变量。本项目线上**不再依赖任何域名变量**，
> 全靠「请求 host」自动同源。`NEXT_PUBLIC_SITE_URL` 仅作为本地 dev 的兜底（`.env` 里用）。

---

## 4. 部署后验证

1. `GET /api/health` 应返回 **200**（它验证 `Next + Payload + PostgreSQL` 整条链路；连不上库会 500）。
2. 打开首页 `https://<域名>/` 应 200，能看到 banner / 公告 / 卡牌。若报 500 且 Sentry 是 `column "prefix" does not exist`，见坑 4（S3 迁移没跑）。
3. 后台 `https://<域名>/admin` 可登录（默认本地账号仅本地有效，生产需用种子或自建管理员）。线上 `serverURL` 留空、走请求 host，访问**任意**主域名 / 部署域名 / preview 都能正常打开后台（见坑 7）。
4. 后台传一张图，前台卡片图能正常显示（验证 B2 + CORS + allPublic）。
5. Sentry 项目 `card-market-nextjs` 能收到错误与 trace（验证 DSN 指向正确项目）。

---

## 5. 本地 ↔ 生产环境变量对照

| 用途 | 本地 `.env` | Vercel |
|---|---|---|
| 数据库 | 无 `DATABASE_URI`；靠 `PG*` 变量（`.env` 模板自带）让 `pg` 回退连接本地库 | 必须显式加 `DATABASE_URI=<Neon 串>`，否则读不到（自动注入的 `POSTGRES_URL` 名对不上） |
| Payload 密钥 | `PAYLOAD_SECRET=dev-only-...` | `PAYLOAD_SECRET=<另一随机串>` |
| 站点域名 | `NEXT_PUBLIC_SITE_URL=http://localhost:3100`<br>（本地 dev 用；线上由「请求 host」自动同源，无需配置） | **无需配置**。`VERCEL=1` 时 `serverURL` 留空 + 请求 host，任意域名/preview 自动正确（见坑 7） |
| S3 | `S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com` 等 | 同左（值一样，因为都连同一个 B2 桶） |
| Sentry | `NEXT_PUBLIC_SENTRY_DSN=...card-market-nextjs...` | 同左（DSN 指向 `card-market-nextjs` 项目） |

> 注意：**Sentry 项目 `card-market-nextjs` 与本仓库同名，但和另一个项目（Directus 版）用的旧 `card-market` 项目是分开的**。两个项目的 DSN 不同，千万别把旧 `card-market` 的 DSN 填进本项目，否则日志会混到一起。
