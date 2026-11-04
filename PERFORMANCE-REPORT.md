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

## 6. 后台 `/admin` 性能（Lighthouse 分析）

> 用 Lighthouse 13 对线上 `https://card-market-nextjs.vercel.app/admin` 跑 performance 审计。
> （沙箱网络无法直连 Vercel，但 Lighthouse 的内置 Chrome 能到达边缘节点，故线上数字真实可用；
> 同时本地 `next build + next start` 连接生产 DB 复测，得到可复现的 before/after。）

### 6.1 Lighthouse 评分（线上，performance 项）

| 指标 | `/admin`（裸，线上实测） | `/admin/`（带斜杠，线上实测） |
|---|---|---|
| 性能总分 | **76** | **89** |
| FCP | 3.5 s | — |
| LCP | 3.5 s | — |
| Speed Index | 7.2 s | — |
| 重定向浪费 | **~1.17 s**（307 `/admin` → `/admin/`） | 仍有 ~0.83 s 重定向链 |

**关键发现：访问裸 `/admin` 比 `/admin/` 低 13 分，整段差距来自一次 307 重定向。**
后台根路由是 Payload 的可选 catch-all `admin/[[...segments]]`，Next 的默认「末尾斜杠」规则会把
裸 `/admin` 重定向到 `/admin/`，线上实测这次跳转浪费 ~1.17 s（含一次额外的冷文档请求）。

### 6.2 本地生产构建 before/after（同一份代码，连接生产 DB）

| 指标 | 修复前 `/admin` | 修复后 `/admin` |
|---|---|---|
| 性能总分 | 76（线上）/ 本地同形态 | **94** |
| FCP | 3.5 s | **1.8 s** |
| LCP | 3.5 s | **1.8 s** |
| Speed Index | 7.2 s | **4.6 s** |
| 重定向浪费 | ~1.17 s | **0 s**（裸 `/admin` 直接 200） |

### 6.3 修复方案：`skipTrailingSlashRedirect: true`

在 `next.config.mjs` 加一项：

```js
skipTrailingSlashRedirect: true,
```

- 作用：关闭 Next 自动的「末尾斜杠」重定向，让 `/admin` 与 `/admin/` **都直接返回 200**，消除那次 307。
- 为什么不用 `trailingSlash: true`：前台 canonical / OG 已在 `src/lib/site-url.ts` 的 `absUrl` 中
  **统一走「无斜杠」绝对地址**；若改成强制带斜杠，会与现有 canonical 冲突、产生重复 URL 的 SEO 隐患。
  `skipTrailingSlashRedirect` 只去掉重定向行为、不改变生成的 URL，与现有 canonical 策略一致。
- 验证：本地 `curl` 实测 `/` `/cards` `/admin` `/admin/` 全部 200，前台路由无任何意外 308；
  生产构建 `next build` 通过，`/admin` 与 `/admin/` 均直接 200。
- 注意（Next 16）：`middleware` 约定已废弃、改名为 `proxy`；本项目的 `src/middleware.ts` 在 Next 16
  下即作为 proxy 运行，仅用于给后台种默认主题 cookie，不参与斜杠重定向，与本次改动无冲突。

> 线上 re-run 分数会随 Vercel 冷启动 / 网络抖动摆动（±15），但本地同构建的 before/after 稳定证明
> 重定向消除把 `/admin` 从 76 → 94。改完需在 Vercel 重新部署生效。

## 7. 前台「页面切换慢」优化（4 项）

> 背景：用户抱怨「页面切换 / 跳转时加载时间过长」。§1–§3 已把单次请求从 2–5.5 s 降到
> 10–50 ms（缓存命中 warm）；但**首次访问某页面**仍要等冷填充（2–4 s），且前端**没有
> 任何加载态与预取**，所以「点下去卡一下」的体感没有被缓解。本组 4 项专门消除
> 「切换时的等待感」，不依赖缓存命中。

### 7.1 根因回顾（切换慢的三层）

1. **无加载态**：所有前台路由 `force-dynamic`，且无 `loading.tsx` / Suspense → 点链接后
   旧页僵住直到新页 HTML 返回，期间白屏或卡顿。
2. **无预取**：`next/link` 默认在生产下虽会 prefetch 静态路由，但本项目全是 dynamic 路由，
   默认 `prefetch="auto"` 对 dynamic 路由**不预取全量**。导航靠点击后才开始取。
3. **冷填充 + 冷实例**：首次访问某查询组合 = 一次实例级 Payload 初始化 + 查库填充缓存
   （2–4 s）；serverless 冷实例再叠加冷启动。

### 7.2 改动 ①：loading.tsx 骨架屏（即时加载态）

新增 `src/app/(frontend)/[locale]/loading.tsx`：在 `[locale]` 段层放一个 Suspense fallback，
由 12 个脉冲卡片占位块组成（复用现有设计令牌 `surface` / `surface-2` / `animate-pulse`）。

- 效果：切换页面时**根布局的顶栏 / 页脚 / 主题脚本照常保留、保持可交互**，只有内容区
  立即切成骨架屏。用户「点下去立刻看到东西」，体感等待归零，而非卡在旧页。
- 附带收益：Next 规则——**dynamic 路由只要存在 `loading.js` 边界，`prefetch="auto"` 就会
  把「到最近 loading 边界为止的局部路由」预取下来**，与改动 ② 互补。

### 7.3 改动 ②：高频入口主动 prefetch

给 `next/link` 显式加 `prefetch`（强制进视口即取全量路由）：

| 文件 | 加 `prefetch` 的链接 | 选择理由 |
|---|---|---|
| `src/components/CardCard.tsx` | 卡牌详情（`/cards/{id}`） | 全站最高频跳转入口 |
| `src/components/layout/SiteHeader.tsx` | logo `/`、店铺 `/shops`（×2）、移动端折叠菜单 4 项 | 顶栏 / 移动端主入口 |
| `src/components/AnnouncementCard.tsx` | 公告详情（`/announcements/{id}`） | 内容续读入口 |
| `src/components/Pagination.tsx` | 上一页 / 下一页箭头 | 翻页最可能的下一步 |

> 分页**页码数字**未全量 `prefetch`：一页最多 9 个 dynamic 路由，进视口全取会同时触发多次
> 服务端渲染并打数据库，反而拖慢。页码保持默认 `auto`（配合 ① 已能廉价预取壳层）；
> 仅 prev/next 两条「最可能点」的箭头开 `prefetch`。

- 效果：链接进入视口（或 hover）即预取目标路由，真正点击时走「已就绪」的导航，
  把「点击 → 取数 → 渲染」的串行等待挪到了空闲时间。

### 7.4 改动 ③：降低冷填充成本（Region 已对齐 + TTL）

- **Region 对齐**：`vercel.json` 的 `regions: ["iad1"]`（= AWS us-east-1），与 Neon Postgres
  （us-east-1）**同区域**，跨区 RTT 已为 0，无需改动。
- **TTL 现状（`src/lib/data.ts`）**：稳定视图已给长缓存——站点设置 86400 s、banner /
  公告 / 卡牌 / 筛选维度 / 店铺 / 信息页均 86400 s、列表 `getCards` 3600 s。冷填充的概率
  已被长 TTL 摊薄到极低（首页/列表这类稳定视图几乎总是命中缓存）。
- **冷实例概率**：由 Vercel 控制台「Function 最小实例数」控制，非代码改动；本组不在代码层
  做（需到 Vercel 后台设置，按预算权衡常驻成本）。

### 7.5 改动 ④：按需失效 + 更长 TTL（已就位并验证）

- **按需失效**：`src/lib/revalidate.ts` 的 `revalidateHook` / `revalidateGlobalHook` 已在
  **所有集合与 `site-settings` 全局的 `afterChange` / `afterDelete`** 钩子里调用
  `revalidateTag(tag, 'max')`（stale-while-revalidate）。后台改完数据即失效对应标签，
  前台下次请求立即回源重取，**无需缩短 TTL 换新鲜度**。
- **标签对齐已核对**：`revalidateHook` 的标签与 `data.ts` 里 `unstable_cache` 的 `tags`
  一一对应（`cards` / `facets` / `announcements` / `banners` / `shops` / `info-pages` /
  `site-settings`），失效确实命中对应缓存条目。
- 结论：本项**此前已实现**，本组仅核对确认其完整性（含此前缺漏的 `site-settings` 全局钩子
  现已存在），不重复造轮子。

### 7.6 验证

- `next build` 通过（TypeScript + 静态页生成均成功）。
- 本地生产构建（`next start`，连生产 DB）warm 导航实测：

  | 路由 | 响应（缓存命中 warm） |
  |---|---|
  | `/zh` 首页 | ~0.5 s（含一次冷填充后） |
  | `/zh/cards` 列表 | 0.20 s |
  | `/zh/announcements` | 0.15 s |
  | `/zh/shops` | 0.009 s |
  | `/zh/cards/1` 详情 | 0.010 s |

- 首页 HTML 中卡牌 `/cards/{id}`、店铺 `/shops`、公告 `/announcements/{id}` 链接均正常渲染
  （默认语言 zh 走无前缀路径，符合 `localizeHref` 设计）；`prefetch` 为 `next/link` 类型化
  prop，已由构建期类型检查确认合法。
- **说明**：`loading.tsx` 的骨架屏与 `prefetch` 的预取是**客户端导航期**行为，curl 取到的首屏
  HTML 不含它们的最终效果，需通过浏览器实际点击 / Lighthouse 交互审计确认体感提升；
  本地网络到 Neon 高于 Vercel 到 Neon，**线上绝对毫秒数会更小**。

> 改完需在 Vercel 重新部署生效。建议线上用 Lighthouse 对「首页 → 列表 → 详情」点击路径跑
> 一次交互审计，确认 TBT / 切换体感改善。

---

## 8. 前台逐页 Lighthouse 评分 + 优化（第二轮）

> 方法：本地 `next build` + `next start -p 3100`，连生产 DB，Chrome headless 对 8 个前台页面
> 分别跑 mobile（throttle）与 desktop 两套 Lighthouse 13。每个页面先 warm（填缓存）再审计，
> 避免冷填充抖动。沙箱到 S3（Backblaze B2，媒体签名下载源）网络**不稳定**，故首页 / 门店页
> 的 mobile LCP 在多次跑分间波动较大（3.6 s ↔ 6.3 s），属基础设施抖动，非代码回归。

### 8.1 优化后的最终评分

| 页面 | Mobile P | Mobile A11y | Mobile BP | Mobile SEO | Desktop P | Desktop A11y | Desktop BP | Desktop SEO |
|---|---|---|---|---|---|---|---|---|
| 首页 `/` | 77–90 | **100** | 96 | **100** | 97 | 100 | 96 | 100 |
| 卡牌列表 `/cards` | 88 | **100** | 96 | **100** | 93 | 100 | 96 | 100 |
| 卡牌详情 `/cards/1` | 89–91 | **100** | 96 | **100** | 97 | 100 | 96 | 100 |
| 公告列表 `/announcements` | 94 | **100** | 96 | **100** | 97 | 100 | 96 | 100 |
| 公告详情 `/announcements/1` | 94 | **100** | 96 | **100** | 97 | 100 | 96 | 100 |
| 门店 `/shops` | 79–82 | **100** | 96 | **100** | 89 | 100 | 96 | 100 |
| 留言 `/message` | **100** | **100** | 96 | **100** | 98 | 100 | 96 | 100 |
| 条款 `/info/terms` | **100** | **100** | 96 | **100** | 96 | 100 | 96 | 100 |

> A11y 全页 **100**；SEO 全页 **100**（本轮补齐 robots.txt + sitemap.xml 后达成）。
> BP 维持 96：仅剩 `image-size-responsive`（见 8.3，S3 源图未出多尺寸）。

### 8.2 本轮修复清单

**① 对比度（A11y：93 → 100）** —— 品牌红顶栏上的文字半透明色被 Lighthouse 判为对比度不足：
- `SiteHeader` 图标按钮 / `<summary>` / 移动菜单链接 `text-white/90`、`text-white/85` → `text-white`
- `ThemeToggle` 按钮 `text-white/90` → `text-white`
- `HomeNotices` 公告「全部」链接 `text-white/90` → `text-white`（Lighthouse 点名元素）
- `HomeFilterSheet` 空态 `text-white/90`、未选中 tab `text-white/85` → `text-white`
- `GlobalSearch` 搜索占位浮层 `text-subtle`（#94a3b8，白底上仅 2.3:1）→ `text-slate-600`（7:1）
  > 注意：搜索框背景写死白，故用固定深色而非语义令牌；深色主题下令牌会变浅，不能用 `text-fg`。

**② 未指定尺寸图片（A11y unsized-images + CLS 隐患）** —— 补 `width`/`height`：
- `SiteHeader` 的 `shop.png`（29×27）、`SiteFooter` / `SiteHeader` 的 logo（取 `ImageView.width/height`，
  后台已写入媒体元数据）、`HighValueStrip` 的 `high_price.png`（205×86）均显式给尺寸。

**③ 可访问性命名（A11y label-content-name-mismatch / aria-command-name）**
- `ShopList` 门店行按钮：原本既带详细 `aria-label` 又含可见文字，两者不匹配 → 去掉 `aria-label`
  （可见内容已完整传达店名 / 地址 / 电话 / 营业时间）。
- `MapView` Leaflet marker：生成的 `role="button"` div 缺可访问名 → 给 `L.marker` 加 `title: 店名`。

**④ SEO：robots.txt + sitemap.xml（SEO 92 → 100）**
- 新增 `src/app/robots.ts`（允许全站，排除 `/admin`、`/api`，指向 sitemap）。
- 新增 `src/app/sitemap.ts`（3 语言 × 静态入口页 = 15 条）。
  > 注意：路由约定文件（robots/sitemap）**必须放在 `src/app/` 根目录**，放在 `(frontend)`
  > 路由组里 `robots.ts` 不会被注册（sitemap 可以，robots 不行——Next 16 的 Turbopack 行为）。
  > `robots.txt` / `sitemap.xml` 已在 middleware matcher 排除列表里，不会被语言 rewrite 拦截。

**⑤ LCP：媒体主机 preconnect + 首屏主图 preload**
- `layout.tsx` `<head>` 注入 `<link rel="preconnect" href="https://s3.us-west-004.backblazeb2.com" crossorigin>`
  （媒体签名下载源，省一次 TLS RTT）。
- 首页 `page.tsx` 对首屏 banner 加 `<link rel="preload" as="image" fetchPriority="high">`；
  门店页同理对默认选中门店大图 preload。
- 效果：首页 mobile LCP 从 5.4 s 降到 3.6 s（preload 生效）；剩余波动来自 S3 抖动。

### 8.3 未做 / 受基础设施约束

- **S3 302 + 原生 `<img>`**：媒体走 `/api/media/file/<id>` → 302 到 B2 临时 URL，next/image 优化器
  无法跟随 302（服务端 400），故全站用原生 `<img>`。这是设计约束，不是缺陷；图片优化只能靠
  `width/height` + `fetchPriority` + preload 这些原生手段，已在 8.2 ②⑤ 处理。
- **image-size-responsive（BP 96 的唯一失分）**：源图未出多尺寸（thumb/card/banner 是 Payload
  自动裁的，但 Lighthouse 仍希望按 DPR/视口给响应式 `srcset`）。next/image 受 302 限制不可用，
  手写 `srcset` 收益有限，暂不做。
- **mobile LCP 上限**：首页 / 门店 LCP 取决于 B2 媒体延迟，沙箱内不稳定。线上 Vercel → B2 同区域
  会更小；preconnect + preload 已把“请求发起时机”压到最早，`next start` 本地测得 desktop LCP
  普遍 1.1–2.2 s，符合预期。
