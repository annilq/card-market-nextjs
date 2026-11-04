# card-market — Payload 版本（Next.js 16 + Payload 3 + PostgreSQL）

用 **Payload CMS 3** 重新实现 [card-market](../card-market)（原 TanStack Start + Directus）的全部业务功能，
用于对比两套技术栈的开发效率与部署方案。数据库同为 **PostgreSQL 17**。

- 后台：<http://localhost:3100/admin>（`admin@example.com` / `admin12345`，仅本地默认值）
- 前台：<http://localhost:3100>（中文）/ `/ja/...`（日本語）/ `/en/...`（English）
- REST API：`/api/cards`、`/api/announcements` …（Payload 自带 REST，公开角色只读已发布内容）

## 快速开始

```bash
# 1. 建库（Postgres 需 13+，本例为本地 postgres 超级用户）
createdb card_market_payload

# 2. 配置环境变量（.env）
# DATABASE_URI=postgres://postgres@localhost:5432/card_market_payload
# PAYLOAD_SECRET=<随机长字符串>
# NEXT_PUBLIC_SITE_URL=http://localhost:3100

npm install

# 3. 建表（Payload 的 Drizzle 迁移）
npm run payload migrate

# 4. 生成类型 / 后台组件表 / 搜索索引
npm run generate:types
npm run payload generate:importmap
npm run indexes          # cards.name / cards.code 的 pg_trgm GIN 索引

# 5. 种子数据（管理员、维度、卡牌、banner、公告、门店、信息页、一条留言）
npm run seed

# 6. 起服务
npm run dev              # http://localhost:3100
```

重置业务数据：`npm run reinit && npm run seed`（保留表结构与管理员账号）。

### Docker（单机部署）

```bash
docker compose up -d --build     # app(:3100) + postgres，上传走持久卷
docker compose exec app npx payload migrate   # 首次：建表
docker compose exec app npm run seed          # 可选：种子数据
```

镜像用 Next.js standalone 输出（见 `Dockerfile`）。
跑 Serverless（Vercel / Lambda）时把 `S3_*` 五个变量填上，上传自动切到 S3 兼容对象存储
（Cloudflare R2 / AWS S3 / DO Spaces）——那里的文件系统是临时的，不能存图。

### 运维备忘

- **改模型后的流程**：改 `src/collections/*.ts` → `npm run payload migrate:create <name>` → `npm run payload migrate` → `npm run generate:types`。
  `push: false` 是刻意关掉的：dev 模式的自动 schema push 会删掉不在模型里的数据库对象（如 `pg_trgm` 索引）。
- **搜索索引**：`src/migrations/20261101_080000_search_indexes.ts`（迁移链里，不会被 push 清掉）。
  已知边界：pg_trgm 需要能抽出三元组，2 个汉字的关键词仍会退化成顺序扫描。
- **备份**：Postgres + `media/`（或 S3 桶）。schema 本身在代码里，不需要额外快照。
- **不要在 `next dev` 运行时跑 `next build`**：两者共用 `.next/`，生产构建会覆盖 dev 已编译的 chunk，
  之后 dev 页面引用的 CSS / JS chunk 会整片 500（表现是页面无样式、控制台一堆资源加载失败）。
  出现这种情况就停掉 dev、`rm -rf .next` 再重启。

```
src/
  app/
    (frontend)/                 前台（Next.js App Router）
      layout.tsx                根布局：html lang / 主题脚本 / 头部 / 页脚 / I18nProvider
      [locale]/                 语言段：zh（无前缀，middleware 重写）/ ja / en
        page.tsx                首页
        cards/page.tsx          卡牌列表（筛选 / 排序 / 分页，状态全在 URL）
        cards/[id]/page.tsx     卡牌详情
        announcements/          公告列表 / 详情
        shops/page.tsx          门店 + Leaflet 地图
        info/[key]/page.tsx     审核信息页（运营信息 / 个人信息收集 / 利用规则 / 数据使用）
        message/page.tsx        留言咨询
    (payload)/                  Payload 后台与 API 路由（模板生成，勿手改）
  components/
    ui/                         shadcn/ui 组件源码（button / card / badge / input / separator / table / tooltip）
    admin/                      后台自定义组件：标识、仪表盘视图、登录页、providers
    catalog/ home/ layout/ shops/   前台组件
  collections/                  集合定义（代码即数据模型）
  globals/SiteSettings.ts       单例站点设置（Payload Global）
  access/                       权限：公开只读已发布、留言公开写不可读
  fields/shared.ts              状态 / 启用 / 排序等共用字段
  lib/
    data.ts                     面向页面的查询层（Local API，overrideAccess: false）
    payload.ts                  getPayload() 单例
    richtext.ts                 Lexical JSON → HTML
    i18n/                       三语文案字典 + 服务端 / 客户端翻译器
    actions.ts                  留言 Server Action
  middleware.ts                 语言段解析 + x-locale 请求头
scripts/
  seed.ts / reinit.ts / ensure-indexes.ts
src/migrations/                 Payload 生成的 SQL 迁移
docs/                           分析与对比文档
```

## 与 Directus 版的关键差异

| 维度 | Directus 版 | 本版（Payload） |
| --- | --- | --- |
| 进程 | 前端 Node + Directus 容器，两个运行时 | 一个 Next.js 进程（后台与前台同源） |
| 取数 | SSR 时多次 REST 往返 | 同进程 Local API 直连数据库 |
| 建模 | `bootstrap.mjs` 脚本 / 后台 UI | `src/collections/*.ts`，进 Git、可 review |
| 迁移 | 无（脚本幂等建表） | `src/migrations/*.ts`（Drizzle） |
| 权限 | 后台角色 + 脚本落库 | 集合上的 access control 函数 |
| 富文本 | Markdown/HTML 字符串 + DOMPurify | Lexical 结构化 JSON → 服务端转 HTML |
| 后台自定义组件 | 独立 Vue 扩展工程，需另构建 | 同仓库 React 组件（`MapPickerField`） |
| 组合唯一约束 | 手写 SQL 唯一索引 | `dedupeKey` 列 + `beforeValidate` 钩子 |
| geo → lat/lng | 数据库触发器 | `beforeChange` 钩子 |
| 留言写入 | 公开 REST create + 字段级权限 | Server Action（无需开放公开写权限、无 CORS） |

细节与实测对比见 [docs/01-analysis.md](docs/01-analysis.md)、[docs/02-stack-comparison.md](docs/02-stack-comparison.md)、[docs/03-admin-design.md](docs/03-admin-design.md)。

### 已知与原站的差异

- **共享元素转场（卡牌图 → 详情页）暂缺**：原站用 TanStack 的 `viewTransition` 支持；
  Next 16.4.3 的 config 已没有 `viewTransition` 键（实测加上会报 "Unrecognized key"），
  因此列表侧的 `vt-card` 挂钩保留但暂不生效。
- **种子卡图必须用真正的卡面图**：曾误把 `directus/uploads/7321f987….jpg`（一张真实人物照片）当示例卡图，
  已换成源站公开页面实际在用的卡面（皮卡丘，172×241），并把误用的文件从 `media/` 与数据库里清掉。

## 验收清单（与原始项目一致）

- [x] 后台可登录，12 个集合/全局齐备（ips / series / sub-series / rarities / cards / banners / announcements / info-pages / shops / messages / media / users + site-settings）
- [x] `(ip, series, subSeries, code)` 重复编号被拒（实测 REST 返回 400 + 中文报错）
- [x] 中文关键词搜索命中 `pg_trgm`（实测 EXPLAIN 走 cards_name_trgm_idx / cards_code_trgm_idx）
- [x] 公开 REST 读不到未发布内容、读不到 `messages`、未来时间的公告与草稿门店不出现
- [x] 列表页级联筛选、价格区间、只看精品、排序、分页全部同步到 URL
- [x] 留言写入成功且状态强制为「新」（Server Action 与公开 REST create 两条路径都验过）
- [x] 四个审核信息页三语 200；未登记 key 404；未发布时仍 200 并提示「尚未发布」
- [x] `/`、`/ja`、`/en` 三语首屏与 `<html lang>` 正确；未知语言段 404
- [x] 门店地图可点选、坐标保存后 lat/lng 同步（种子数据已验证钩子镜像）

## 监控（错误上报 / 日志 / 存活）

部署到 VPS 后建议同时上三层监控，全部可跑在同一台机器、免费：

### 1. 错误上报 — Sentry

`@sentry/nextjs` 已接入，对 App Router 的 Server Actions、API Routes、SSR、
客户端 `error.tsx` 背后的异常、未捕获 Promise 全部自动上报；Payload 跑在 Next 进程内，
服务端异常也会被捕获。现有 `src/app/(frontend)/[locale]/error.tsx` 继续做用户可见兜底。

- 配置入口：`sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts`（根目录）
- 注入点：`src/instrumentation.ts`（项目用了 `src/`，所以放这里）
- 构建包裹：`next.config.mjs` 用 `withSentryConfig(withPayload(nextConfig), …)` 包了一层
- 环境变量（见 `.env.example`）：`NEXT_PUBLIC_SENTRY_DSN`、`SENTRY_ORG`、`SENTRY_PROJECT`、`SENTRY_AUTH_TOKEN`
  - DSN 留空时 Sentry **自动降级为不发送**，不影响构建与运行；填上即用
  - 免费版用 [Sentry Cloud](https://sentry.io)（5k events/月）；想自托管可用 [GlitchTip](https://glitchtip.com)（Sentry 兼容、更轻）
  - `SENTRY_AUTH_TOKEN` 仅在「构建时上传 source map」时需要，可先不填（堆栈会是压缩后的）

### 2. 日志 — Dozzle

`node server.js` 的服务端日志打到容器 stdout，`docker-compose.yml` 已加 `logs` 服务
（只读 `/var/run/docker.sock`），提供 Web UI 实时看 `app` 容器日志、可搜索、可回溯。零代码改动。
访问 `http://127.0.0.1:8080`（已绑本地，见下方反代说明）。

### 3. 存活 + 资源 — Uptime Kuma

`docker-compose.yml` 已加 `uptime` 服务，监控公网域名和 `/api/health` 探针，
挂了/证书过期/端口不通就推 **Telegram / Discord / 邮件 / Webhook**。
访问 `http://127.0.0.1:3001`（已绑本地）。主机资源（CPU/内存/磁盘）可再加 Netdata 容器。

健康检查端点：`src/app/api/health/route.ts` → `GET /api/health`，
验证「Next + Payload + PostgreSQL」整条链路，正常 200、异常 500。

### 反代与暴露

`app` / `logs` / `uptime` 现在分别绑在 `3100` / `127.0.0.1:8080` / `127.0.0.1:3001`。
`logs` 和 `uptime` 只绑本地，**务必用 VPS 上已有的 nginx/caddy 反代 + 鉴权**后再暴露公网，别裸奔。
新服务上线：`docker compose up -d --build`（也会把 Sentry 的 instrumentation 编进 standalone 镜像）。

