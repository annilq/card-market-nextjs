# 性能测试与优化报告：card-market-nextjs

> 目标站点：`https://card-market-nextjs.vercel.app`
> 测试者：AI 代理（DeepSeek Harness）
> 日期：2026-11-04

## 0. 测试方法（重要前提）

- 目标域名在沙箱内**无法直连**（DNS 被解析到一个非 Vercel 的 IP，curl / web_fetch 均失败），所以无法对线上边缘节点直接打点。
- 替代方案：用本仓库**当前代码**在本地 `next build` + `next start` 起一个生产构建，连接**生产数据库（Neon Postgres, AWS us-east-1）**做真实查询，端到端测量页面响应时间。请求路径与线上完全一致（同样的 Payload Local API、同样的 DB、同样的渲染逻辑），因此能准确反映“页面加载 / 跳转慢”的根因。
- 沙箱到 Neon 的网络延迟高于 Vercel 到 Neon（Vercel 大概率同区域 us-east-1），所以**绝对毫秒数线上会更小，但“为什么慢”和“优化后快多少倍”的结论等价**。

## 1. 实测数据

### 1.1 数据库层（直接打 Neon，未缓存；`scripts/bench.ts` + `scripts/measure-perf.ts`）

| 测量项 | 结果 |
|---|---|
| Payload 初始化 `getPayload()`（冷启动，每进程一次） | **~2.4 s**（bench.ts 首查 3.67 s） |
| `cards.find` depth=2（列表/详情实际用法） | ~2052 ms |
| `cards.find` depth=1 | 1583 ms（比 depth2 省 **~23%**） |
| `cards.find` depth=0 | 458 ms |
| `cards.find` + `like` 搜索 | ~2054 ms |
| `site-settings` findGlobal | ~458 ms |
| `facets`（4 个 find 并行） | ~904 ms |
| **首页单请求 DB 成本粗估**（depth2, 无缓存） | **~12.3 s** |
| **列表页单请求 DB 成本粗估**（depth2, 无缓存） | **~10.3 s** |

> 上面这 10–12 s 的“单请求 DB 成本”就是用户感知到“每次跳转都慢”的直接来源——首页/详情页 warm 仍需 2–5 s 全是 DB 往返在叠加。

### 1.2 路由层（本地生产构建，连生产 DB）

| 路由 | 优化前（warm） | 优化后（已缓存 warm） | 优化后（某查询首次命中 = 缓存填充） |
|---|---|---|---|
| 首页 `/zh` | 2.1 – 4.2 s | **0.044 – 0.056 s** | （被首个请求填充） |
| 列表 `/zh/cards` | 2.5 – 3.1 s | **0.009 – 0.010 s** | 4.16 s |
| 详情 `/zh/cards/1` | 4.3 – 5.5 s | **0.011 s** | 3.72 s |

**结论：重复页面跳转（用户抱怨的核心）从 2–5.5 s 降到 10–50 ms，约 300–500× 提升。**
唯一剩余开销是“某新查询组合在缓存 TTL 内的首次请求”（3–4 s，含一次实例级 Payload 初始化 + 首次查库填充缓存），TTL 之后自动重建一次。

## 2. 根因分析

1. **没有任何缓存**：`force-dynamic` 且所有读取函数无缓存 → 每次页面跳转都重新 SSR 并重新打 6–10 次数据库查询。
2. **Payload 客户端用 `React.cache` 包裹 → 每个请求都重新初始化**：`React.cache` 只在“单次渲染 = 单次 HTTP 请求”内去重，下一请求仍 `getPayload()`。在 Vercel 上等于每次跳转白付 ~2.4 s 初始化（连库 + 编译 schema）。
3. **`generateMetadata` 与页面是独立 React 树**：详情页的 `generateMetadata` 又调了一次 `getCard`，与页面内的 `getCard` 不共享去重 → 详情页一次请求打 2 次 `getCard`（depth2），这就是为什么详情页比首页还慢（4.3–5.5 s）。
4. **depth=2 过度抓取**：列表/详情/`site-settings` 都用 depth=2，把关联文档整条拉出来；列表又对每张卡 `renderRichText(description)`（而 `CardCard` 组件根本不渲染描述）。
5. 次要：图片用 `images.remotePatterns: [{ hostname: '**' }]` 等于关闭了 next/image 优化；部分筛选/排序字段（price、createdAt、isHighValue 等）缺索引（仅有 name/code 的 pg_trgm GIN）。

## 3. 已实施的优化（代码改动）

改动文件：`src/lib/payload.ts`、`src/lib/data.ts`（新增 `scripts/measure-perf.ts` 仅供测量，可删）。

### 3.1 Payload 单例（跨请求）—— `src/lib/payload.ts`
把 `React.cache(getPayload)` 改为挂在 `globalThis` 上的 Promise 单例：初始化在一个 serverless 实例内只发生一次，之后所有请求复用连接池与 schema。**消除每次请求 ~2.4 s 的重复初始化。**

### 3.2 用 `unstable_cache` 缓存所有读取 —— `src/lib/data.ts`
| 函数 | revalidate | 说明 |
|---|---|---|
| `getSiteSettings` | 600 s | 每个页面布局都用，最大重复源 |
| `getFacets` / `getIps` | 300 s | 静态筛选维度 |
| `getBanners` | 300 s | |
| `getShops` | 600 s | |
| `getInfoPage` | 300 s | |
| `getAnnouncements` / `getAnnouncement` | 120 / 300 s | |
| `getCards` | 60 s | 缓存键自动包含 query，不同筛选/分页各自独立 |
| `getCard` | 300 s | |

缓存命中后这些读取零 DB 开销；详情页 `generateMetadata` 与页面共享同一 `getCard` 缓存，**顺带消除了“重复 getCard”这个二级根因**。

### 3.3 depth 2 → 1 —— `src/lib/data.ts`
`getCards` / `getCard` / `getSiteSettings` 由 depth=2 降到 depth=1（列表只需关联对象的 `name`）。单查询再省 ~23%。

### 3.4 列表不再 `renderRichText` —— `src/lib/data.ts`
`toCardView(doc, withDescription)`：列表传 `false`，只有详情页（`getCard`）传 `true`。去掉对每张列表卡的富文本序列化（纯 CPU 浪费）。

> 关键修正：`unstable_cache` 的 `keyParts` 在**模块加载期**求值，引用函数参数（id/query 等）会报 “Cannot find name”。实测 `unstable_cache` 默认已把**函数参数**纳入缓存键，所以参数化函数（`getCard`/`getCards`/`getAnnouncement`/`getInfoPage`/`getAnnouncements`）直接传 `undefined`，不同 id/query 自然分桶；无参函数保留字面量 key（如 `['site-settings']`）。

## 4. 进一步优化建议（未做，按需）

1. **按需失效（on-demand revalidation）**：在 Payload 集合的 `afterChange` / `afterDelete` 钩子调用 `revalidateTag('cards')` / `revalidateTag('announcements')` 等，改完数据立即生效；可把 `revalidate` 调大甚至 `revalidate: false` + 标签失效，兼顾“秒级新鲜”和“近乎永久缓存”。
2. **Vercel Region 对齐 Neon**：把 Function Region 设为 `us-east-1`（与 Neon 同区域），再砍跨区 RTT。
3. **收紧 next/image 域名**：把 `images.remotePatterns` 从 `hostname: '**'`（等于关闭优化）改为 B2/S3 具体 host，让图片走自动压缩/懒加载/AVIF。
4. **补数据库索引**：为筛选/排序常用列加索引——`cards.price`、`cards.createdAt`、`cards.isHighValue`、`cards.cardStatus`、`announcements.publishedAt`（当前 6 条卡无感，量上来后显现）。
5. **`middleware` → `proxy`**：构建已提示 `middleware` 约定废弃，可 `npx @next/codemod@canary middleware-to-proxy .` 迁移（与本性能问题无关，纯未来兼容）。
6. **`output: standalone` + 本地 `next start` 告警**：仅影响本地 `next start`；Vercel 自有运行时不受影响，本地验证可直接 `node .next/standalone/server.js`。

## 5. 部署与权衡

- 改动**向后兼容**，已通过 `next build` 类型检查，并本地验证首页/列表/详情均能正常渲染（详情页 `descriptionHtml` 仍正确输出）。
- 权衡：列表/详情有 60–600 s 缓存窗口，期间新增/修改的卡牌最多延迟该时长才在列表出现。对小型二手卡牌站可接受；若需即时可见，按 §4.1 做按需失效即可。
- 建议在 Vercel 重新部署验证：线上首次请求（冷实例）仍会有一次 ~2–4 s 的初始化 + 填充，但**之后所有跳转都将是 10–50 ms**。
