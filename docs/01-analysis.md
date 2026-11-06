# koduckya 业务功能与技术架构分析

> 分析对象：`/Users/annilq/Documents/develop/card-market`（TanStack Start + Directus 11 + PostgreSQL）
> 目的：为「用 Payload 重新实现同一套功能」提供功能清单与架构基线，并作为两套技术栈对比的事实依据。

## 1. 业务定位

TCG 卡牌（宝可梦 / 游戏王 / 龙珠等）的**展示 + 回购信息站**，不是电商。

- **主访客（买家）**：从 X / 搜索进入，多为手机端，目标是快速确认「有没有这张卡、什么价、什么成色」，再决定咨询或到店。
- **次访客（卖家）**：从「高价买取」入口确认收购范围与价位，然后留言咨询。
- **管理员（客户本人，1 名非技术运营者）**：在后台维护卡牌、分类、banner、公告、门店、信息页与留言，不改代码。

**成功标准**：访客能顺畅浏览并产生咨询 / 到店；客户能独立在后台维护内容。

**明确不做**：购物车、在线支付、订单、物流、库存交易、会员体系。任何交易闭环都超出范围。

## 2. 功能清单（按前台页面）

| 模块 | 能力 | 后台集合 |
| --- | --- | --- |
| 首页 | banner 轮播（单槽位）、通知公告入口、高价买取横条、按 IP 浏览、最新上架、全站搜索框 | `banners` / `announcements` / `cards` / `ips` |
| 卡牌列表 | IP→系列→子系列**级联筛选**、稀有度、只看精品、价格区间、关键词（卡名 + 编号）、排序（价格升降 / 最新 / 最早）、分页，**全部同步到 URL** | `cards` + `ips`/`series`/`sub_series`/`rarities` |
| 卡牌详情 | 多图画廊、成色（裸卡 / 有包装）、编号、IP/系列/稀有度、描述、「咨询此卡」 | `cards` |
| 公告 | 列表（置顶优先）+ 详情；支持定时发布（`published_at` 未来不展示） | `announcements` |
| 门店 | Leaflet + OpenStreetMap 地图 + 门店列表联动，营业时间 / 电话 / 地址 | `shops` |
| 留言 | 表单（内容必填，联系人 / 联系方式选填，可关联卡牌），提交后仅后台可见 | `messages` |
| 审核信息页 | 运营信息 / 个人信息收集 / 利用规则 / 数据使用，footer 常驻入口 | `info_pages` |
| 站点设置 | 站点名、Logo、简介、X 账号、联系方式、营业时间、数据说明、隐私政策 | `site_settings`（单例） |
| 界面多语言 | 中文（默认，无前缀）/ 日本語 `/ja` / English `/en`；未知语言段 404；`hreflang` + 三语路径 | — |
| 主题 | 浅色 / 深色，跟随系统 + 手动覆盖，无闪烁脚本 | — |

## 3. 数据模型

三层分类维度 + 实体：

```
ips (IP/大类) ──< series (系列) ──< sub_series (子系列)
                                        ▲
rarities (稀有度) ────────────── cards ──┘   cards ──M2M──> directus_files (图片)
```

- `cards`：`name` / `ip_id` / `series_id` / `sub_series_id` / `rarity_id` / `code` / `price` / `images`(M2M) / `description` / `is_high_value` / `card_status`(裸卡|有包装) / `status`(草稿|已发布|已归档)。
- **组合唯一约束**：`(ip_id, series_id, sub_series_id, code)`（子系列必填，否则 SQL NULL 让唯一约束失效）。
- `messages` 使用**自定义工单枚举**（新 / 已处理 / 已归档 / 已标记垃圾），刻意不使用内容集合的发布状态。
- 索引：`cards.name` / `cards.code` 的 `pg_trgm` GIN 索引（中文子串模糊匹配）。

## 4. 权限模型

| 角色 | 读取 | 创建 | 其他 |
| --- | --- | --- | --- |
| Public | `cards`/`banners`/`announcements`/`shops`/`info_pages`/`site_settings`/`directus_files`，**带 `status=published` 过滤**（公告额外要求 `published_at <= now`） | `messages`（仅 `content`/`contact_name`/`contact_info`/`card` 四字段） | 不可读 `messages`，不可写其他集合 |
| Admin | 全部 | 全部 | 后台 UI |

## 5. 技术架构（现状）

```
浏览器 ──HTTPS──> TanStack Start（SSR，React 19 + Vite + Tailwind v4）
                     │ 只读 Directus 公开 REST API（+ 留言 POST）
                     ▼
              Directus 11（容器 :8055）──> PostgreSQL 17（本机 :5432）
                     │
                     └──> 本地文件 / S3 兼容对象存储（图片）
```

- **前端零自定义后端**：所有读走 Directus 公开 API，留言走 Directus 的公开 create 权限，没有自研 API 层。
- **后台零自研 CRUD**：复用 Directus `/admin`；只有两处自定义扩展（`map-picker` 地图选点、`status-switch` 列表页状态切换），均需单独构建成 Vue 扩展产物。
- **图片**：Directus 资产接口 `/assets/<id>?width=&format=webp` 做缩略图 / WebP 转换。
- **富文本**：后台存 Markdown / HTML 混合文本，前端 `markdown-it` 解析 + `DOMPurify` 清洗后 `dangerouslySetInnerHTML`。
- **部署形态（现状，本机）**：Postgres.app 实例 + `docker run` 起的 Directus 容器（`host.docker.internal` 连库）；生产方案仍是未决 ticket（日本 + 美国双区域，R2 / S3+CloudFront 二选一）。

## 6. 已知的痛点（后续对比时的对照项）

1. **两个运行时**：前端 Node 进程 + Directus 容器，两套环境变量、两套部署与监控。
2. **每次读都是一次 HTTP 往返**：SSR 渲染一页要串多次 REST 请求。
3. **自定义扩展要单独构建**：Vue 扩展工程 + 构建产物 + 容器挂载，改动链路长。
4. **复合唯一约束 / 触发器靠手写 SQL**：`bootstrap.mjs` 里直接建唯一索引与 `trg_shops_sync_geo` 触发器（因为 Directus 单接口写不了兄弟字段）。
5. **M2M 元数据脆弱**：`junction_field` 漏配会让后台按钮消失，且只能通过裸 `/relations` PATCH 修，容易顺手删掉外键（源码注释里明确写了踩坑）。
6. **富文本是可执行字符串**：必须 Markdown 解析 + DOMPurify 清洗，多一层 XSS 面。
7. **权限是一次性脚本落库**：`bootstrap.mjs` 幂等写权限，模型变更要跟着改脚本。

## 7. 迁移到 Payload 时的映射原则

| 维度 | Directus 版 | Payload 版（本仓库） |
| --- | --- | --- |
| 建模方式 | 运行时脚本 / 后台 UI 建集合 | `src/collections/*.ts` 代码即模型，可进 Git |
| 数据访问 | 跨进程 REST | 同进程 Local API（`getPayload()` 直连 Drizzle） |
| 迁移 | `bootstrap.mjs` 幂等脚本 | `payload migrate` + `src/migrations/*.ts` |
| 权限 | 后台角色 + 脚本落库 | 集合上的 access control 函数（代码） |
| 富文本 | Markdown/HTML 字符串 | Lexical 结构化 JSON → 服务端转 HTML |
| 自定义后台组件 | Vue 扩展工程，独立构建 | 同仓库 React 组件 + `admin.components.Field` |
| 复合唯一 | 手写 SQL 唯一索引 | `dedupeKey` 计算列 + `beforeValidate` 钩子 |
| geo → lat/lng | 数据库触发器 | `beforeChange` 钩子 |
| 单例配置 | 单条记录的集合 | Payload Global |

> 详细的开发体验与部署对比见 `docs/stack-comparison.md`（待实测数据填充）。
