# 后台设计：Linear 的克制

> 后台（Payload Admin）的主题在两个地方落地，都不碰 Payload 的内部 class 名——
> 那些名字会随版本变，猜了就会在升级时静默失效。

## 1. 落地点

| 文件 | 作用 |
| --- | --- |
| [src/app/(payload)/custom.scss](../src/app/(payload)/custom.scss) | 主题令牌：浅色 / 深色两套 Payload CSS 变量、字体、圆角；外加导航 / 顶栏 / 表格 / 控件的精修 |
| [src/components/admin/admin-ui.css](../src/components/admin/admin-ui.css) | 自家界面的样式入口：shadcn 语义令牌 + Tailwind 工具类（只引 `theme` 与 `utilities`，不引 `preflight`） |
| [src/components/ui/\*](../src/components/ui) | shadcn/ui 组件源码（button / card / badge / input / separator / table / tooltip / skeleton） |
| [src/components/admin/AdminProviders.tsx](../src/components/admin/AdminProviders.tsx) | `providers`：把 `admin-ui.css` 带进后台 bundle，并提供 Tooltip Provider |
| [src/components/admin/AdminNav.tsx](../src/components/admin/AdminNav.tsx) | `Nav`：自定义侧栏，集合与全局**平铺成一级菜单**（替换 Payload 的分组二级菜单） |
| [src/components/admin/AdminNavLinks.tsx](../src/components/admin/AdminNavLinks.tsx) | 侧栏链接列与外壳（客户端：当前项、`useNav()` 的抽屉状态） |
| [src/components/admin/entity-meta.ts](../src/components/admin/entity-meta.ts) | 集合图标与一句话说明：侧栏与仪表盘共用同一张表 |
| [src/components/admin/StatusCell.tsx](../src/components/admin/StatusCell.tsx) | 列表里「状态」列的语义色胶囊（挂在 `statusField()` 的 Cell 上） |
| [src/components/admin/Brand.tsx](../src/components/admin/Brand.tsx) | `graphics.Logo`（登录页大标）与 `graphics.Icon`（导航小标） |
| [src/components/admin/DashboardView.tsx](../src/components/admin/DashboardView.tsx) | `views.dashboard`：替换 Payload 默认的「集合卡片墙」 |
| [src/components/admin/LoginIntro.tsx](../src/components/admin/LoginIntro.tsx) | `beforeLogin`：登录页站名 |
| [src/payload.config.ts](../src/payload.config.ts) → `admin.components` | 上面几个组件的挂载点 |
| [src/middleware.ts](../src/middleware.ts) | 给首次访问后台的浏览器种下 `payload-theme=dark`，服务端首屏直接输出深色 |

截图见 [docs/screenshots/](./screenshots/)（登录页 / 仪表盘 / 列表页，浅色与深色）。

## 2. 为什么不做成「完整孟菲斯」

孟菲斯的圆 / 三角 / 波浪线配四个高饱和色，是给「一眼被认出来」的落地页用的。
后台是另一种场合：运营者每天在这里待几十分钟盯表单和列表，装饰色会**和内容抢注意力**，
还会**和状态色打架**——孟菲斯的红 `#db261d` 与「错误」红是同一支色，
铺在背景上时，真正的错误提示反而被稀释了。

现在颜色只做一件事：**强调**。中性色阶负责结构，品牌红只出现在
主按钮、当前选中项、待处理计数这些「要你看这里」的位置。

## 3. 设计分工

**中性色阶负责「结构」**（覆盖 Payload 的 `--theme-elevation-*`）：

- 浅色：页面 `#f6f7f8`，卡片 `#ffffff`，描边 `#e0e2e6`
- 深色：页面 `#08090a`，卡片 `#101113`（比页面亮一档，卡片才浮得起来），描边 `rgb(255 255 255 / 0.09)`
- 两套主题共用同一支 22 级灰阶：改一处两边一起动，不会出现「接缝」
- 正文色取 `elevation-650`：再淡一档（`550`）在两套主题下都掉到 4.5:1 以下，结构文字会开始「消失」

**品牌红负责「强调」**：主按钮、当前导航项底色、待处理计数。
深色下**刻意不提亮**——白字压在 `#e4372d` 上只有 4.3:1，压在 `#db261d` 上才是 4.87:1。
需要提亮的只有「淡红底上的红字」（`--primary-soft-fg`）和 Logo 渐变，它们上面不压白字。

**其他基调**：

- 圆角 6 / 8 / 10px：控件偏方，卡片略圆
- 层级靠 1px 描边 + 底色一档之差，不用投影
- 正文 14px（Payload 默认 13px 偏小）、抗锯齿
- 字体栈 `'Inter', -apple-system, …`（不挂 webfont，避免运行时外部依赖）
- 过渡统一 120ms ease-out，遵循 `prefers-reduced-motion`
- 选中色 / 光标色 / 滚动条也一并接管：留着浏览器默认值等于让一半界面不归我们管

**按钮：所有档位都是同一支红的四个浓度**（后台所有按钮都带 primary 色）：

| 档位 | 形态 | 用在哪 |
| --- | --- | --- |
| solid | 实心红底 + 白字（4.87:1） | 主操作：保存 / 发布 / 创建 / 提交 |
| tint | 10~16% 红底 + 红字 + 红描边 | 次要：取消 / 筛选 / 切换 / pill |
| ghost | 透明底 + 红字 | 幽灵与图标按钮（行内小图标、关闭、更多） |
| tab | 中性 | 文档页的「编辑 / API」——它是「当前在哪一页」的指示，不是动作，给它上红会和真正的操作按钮抢注意力 |

为什么连次要按钮也要带红：后台是低彩度的中性界面，一支红只出现在主按钮上时，
「可点」这件事在视觉上不成系统，用户得靠位置去猜哪个能点。
浓度分级保证层级仍然清楚：实心一处，淡填充若干，透明若干。

深色下的红字要提亮（`#f4645c`）：`#db261d` 压在 16% 红底上只有 3.1:1。

## 4. 侧栏为什么只有一级菜单

Payload 默认的侧栏把集合按 `admin.group` 折成六组可折叠的二级菜单
（系统 / 素材 / 分类 / 商品 / 内容 / 设置）。13 个入口分成六摞之后，
每次找东西都要「先展开、再找」，而运营每天进的其实是固定的那两三个集合——
多出来的这一层只有成本。

现在换成一条平铺列表：顺序 = 配置顺序，每项带图标，当前项 2px 品牌红指示条 +
淡红底，登出仍在底部。

三个不能省的细节：

1. 外壳复刻 Payload 内部 `NavWrapper` 的结构（`<aside class="nav"><div class="nav__scroll">`）。
   Payload 的 CSS 靠 `nav--nav-hydrated` / `nav--nav-open` 决定「≤1440px 收成抽屉」，
   少了这些类，窄屏侧栏会一直 `display: none`。
2. **桌面挂载即展开**（`AdminNavShell` 里 `window.matchMedia('(min-width: 1024px)')`）。
   Payload 只在 ≥1441px 才让侧栏开着，而团队主力分辨率是 1440×900 / 1280×800——
   在这两台机器上 13 个集合的入口原本是 `opacity:0` + `inert`
   （不只是看不见，是被移出无障碍树），只剩一个没有无障碍名的 24px 汉堡。
   只在挂载时做一次：之后用户自己收起不会被抢回来，<1024 仍走 Payload 的抽屉。
3. 权限过滤与默认实现同一套规则（`visibleEntities` + `permissions.*.read`），
   只是不再分组——换个账号进来看到的仍然是它能看的那些集合。

13 项平铺在 248px 里仍是一面墙（只靠 2px 红条区分）。与其重新折成二级菜单
（那是 §4 论证过的另一种成本），侧栏顶部给了一个**集合筛选框**：名称、slug、
以及 `entity-meta.ts` 里那句说明都能命中——运营更可能记得「放图片的」而不是集合的技术名。

## 5. 列表与详情：把内容从背景里「托」出来

Payload 的列表表格与编辑表单都是**直接画在页面底色上**的，没有自己的表面。
深色下近黑压近黑、浅色下白压白（原来 `#f6f7f8` 与白卡片只差 2%），
只剩几根发丝线，内容与背景就混在一起了。

三件事把它们分开：

1. **页面与表面拉开一档**：浅色页面压到 `#edeff2`（白卡片与它的亮度差从 1.02 提到 1.15），
   深色描边从 9% 提到 13% 白；
2. **给表格一张表面**：`.collection-list__tables .table-wrap` 加底色 + 描边 + 10px 圆角，
   并收掉 Payload 让表格出血到屏幕两端的那段负边距（要包在圆角里就不能出血）；
   表头做成底色更深一档的独立带子，行与行之间补 1px 分隔线；
3. **表单控件抬到卡片之上**：输入框底色比卡片亮一档（深色 `#191b1e`、浅色纯白 + 更实的描边），
   去掉 Payload 那层 `0 2px 2px -1px` 投影（它让控件和卡片糊在一起），
   聚焦时给品牌红描边 + 18%/32% 外扩环；字段标签加粗到 600。

#### 侧栏与仪表盘的 rem 标尺必须自己钉一次

Payload 把 `html{font-size:13px}`，而 `rem` 永远以**根元素**为基准，
于是 Tailwind 的 rem 工具类在这套后台里按 **81%** 渲染：`text-sm` = 11.375px
（卡片标题比它自己的 13px 副标题还小）、`h-7` = 22.75px（低于 24px 最小热区）、
`size-4` 图标 = 13px。改 `html` 的字号会把 Payload 自己的间距一起放大 23%，风险太大；
解法是在 `[data-admin-ui]` 里把 `--spacing` 与 `--text-*` 重新钉到 16px 根对应的值，
只影响我们自己的子树。

#### 键盘焦点与占位符是两处 Payload 没覆盖到的地方

- Payload 只给**表格里的链接**写了聚焦环（`.table a:focus-visible`）。侧栏链接与
  仪表盘里我们自己的链接落在它外面，聚焦时毫无指示——已在 `custom.scss` §6 与
  `admin-ui.css` 补上（品牌红 2px + 2px 偏移）。shadcn 的 `ring-ring/60` 实测 2.71:1，
  低于非文本 3:1 的要求，去掉了 `/60`。
- 输入框占位符用的是 `elevation-400`（实测 2.0:1 深色 / 1.6:1 浅色）。占位符也是文字，
  已抬到 `elevation-650`（两套主题各约 5.9:1）。

编辑页**没有**整体包卡片：分组（`group-field`）会向两侧出血一个 gutter，
包进圆角容器就会溢出边界，所以那一页靠「控件抬升 + 分隔线加重 + 侧栏分隔线」来表达层级。

### 状态列为什么换成语义色胶囊

状态列原来是纯文字，和「卡牌名称 / 编号」这些普通文字长得一样，扫一列看不出哪几行是草稿。
现在走 [StatusCell.tsx](../src/components/admin/StatusCell.tsx)（挂在 `statusField()` 与
`Messages.status` 的 `admin.components.Cell` 上）渲染成一枚**可直接在列表里改**的胶囊
（交互在 [StatusQuickSelect.tsx](../src/components/admin/StatusQuickSelect.tsx)），语义只有三档：

| 档 | 色 | 值 |
|---|---|---|
| 生效中 / 已处理 | 绿 | `published`、`processed` |
| 需要留意 | 琥珀 | `new`、定时未到点 |
| 未生效 / 已终止 | 中性 | `draft`、`archived`、`spam` |

**红色不用在这里**——红留给错误提示。文案仍取选项上的 `{ zh, en, ja }` 翻译，不写死中文。

胶囊本身是一颗**有描边和 chevron 的按钮**——静态胶囊没有任何「可切换」的标识，
用户因此以为状态只能进详情页改（四步）。菜单走 **portal**：工作区面板用了
`overflow: clip` 裁圆角，菜单留在单元格里会被整块裁掉。写入走 Payload 自己的 REST
（同域 + cookie），成功后 `router.refresh()`，失败给一条提示——静默失败会让人以为
工单处理了其实没有。

`publishedAt` 晚于当前时刻时，状态胶囊旁边会再跟一枚「定时 · 日期」：
状态已经是「已发布」但前台还没到点，列表里必须看得出差别，
否则运营无法回答「这条上线了没有」——定时内容里风险最高的一个问题。

### 踩坑：Tailwind 的 `dark:` 在后台里默认不生效

Payload 的主题开关是 `html[data-theme='dark']`，而 Tailwind 默认的 `dark:` 走
`prefers-color-scheme`（系统偏好）。后台用户在浅色系统上选深色时，
`dark:text-emerald-400` 这类写法不会生效，深色态只能拿到浅色那条颜色——
实测 11px 徽章的对比度因此掉到 4.37:1。
解法见 [admin-ui.css](../src/components/admin/admin-ui.css) 里的
`@custom-variant dark (&:where(html[data-theme='dark'], …))`。

## 5c. 三级表面：页面 < 栏 < 面板

「区域」这件事在后台里长期只靠一条 1px 分割线表达：**线能标出边界，但标不出归属**——
看不出哪些控件属于哪一块，于是每块内容都糊在灰色页面上。现在每一层都有自己的底色，
方向在两套主题里一致（越靠近内容越亮）：

| 层 | 区域 | 形态 |
|---|---|---|
| 层 | 区域 | 形态 | 浅色 | 深色 |
|---|---|---|---|---|
| 页面 | — | 平铺，**只在间隙里露出来** | `#f2f5f8` | `#08090a` |
| 栏 | 导航区（侧栏）、工具条（顶栏） | 铺满、**无圆角**、**与面板同色** | `#ffffff` | `#1b1e24` |
| 面板 | 工作区：列表页一整块，详情页标题区 / 主字段区 / 侧字段区（含仪表盘卡片） | 描边 + 10px 圆角 + 内边距 | `#ffffff` | `#1b1e24` |

**栏和面板是同一个颜色**——不是「栏比面板暗一档」。两者靠**形状**和**间隙**区分：
栏贴着视口边缘、铺满、直角；面板圆角、四周留出 24px 间隙。分隔不靠描边，靠间隙里的页面底色。

所以工作区面板必须**收进去**（`margin: 16px 24px 24px`）：之前它与栏同宽贴着走，
页面底色只在面板下方露了一道，其余地方看不出区域边界。

**页面底色只出现在栏与面板的间隙里**——那些间隙本身就是分割线，不再靠画线分隔区域。

**圆角是一个信号**：直角 = 一条栏，圆角 = 一块内容。

**必须的副产物：侧栏要真的在屏幕上。** Payload 的 `NavProvider` 在 ≤1440px 会
**异步**读一次「侧栏开合」偏好并覆盖 state——只在挂载时设一次会被覆盖掉，
实测 1440×900 下回到 `opacity:0` + `grid: 0px 1440px`，等于主力分辨率上没有菜单。
现在在挂载后头一秒里重设几次赢下这个竞态，之后交回给用户（<1024 仍是抽屉）。

**字号**：Payload 的根字号是 13px，全站默认跟着偏小，但**不去抬 `html` 的字号**——
`--base = (20/13)rem`，根字号一动它自己的间距与控件高度会整体放大 15~23%。
做法是逐处钉 px：菜单 / 单元格 / 字段标签 / 输入框 14px，表头 12px（仍明显弱于正文）。

**每级差多少才够**：第一版深色的栏只比页面亮 6/255，被读成「没有背景」；
现在拉到 11/255（浅色 14/255）。深色下这个比例看着小（约 1.07），
但暗背景上绝对差是分得出来的——深色里靠的就是绝对差而不是比例。侧栏和顶栏贴着视口边缘且纵向/横向铺满，
给它们圆角会在边缘留下缺口，所以它们用直角；工作区内部用圆角。

两条执行约束：

1. **同一个层级只能有一个值**。仪表盘的 shadcn 卡片原来用 `--card: #101113`，
   比列表页的面板暗一档——同一层出现了两个值。现在 `--card` 与 `--panel-bg` 对齐，
   popover 再高半档。
2. **不允许面板套面板**。上一轮给列表的 `.table-wrap` 单独包过一张面板，
   外层这一层加上之后必须把它去掉——否则两张卡片的描边叠在一起，层级反而读不出来。
   表头带子与行分隔线保留在面板内部。
3. 详情页能整块包面板，是因为**这份模型里没有任何 `group` / `tabs` 字段**
   （Payload 那两种字段会向两侧出血一个 gutter，有的话整块包就会溢出边界）。

区域的名字定在 [GLOSSARY.md](../GLOSSARY.md)：导航区 / 工具条 / 工作区 / 栏与面板的区别。

## 5d. 富文本编辑器：工具条与存储格式

**存储格式是 Lexical 的结构化 JSON，不是 markdown。** 实测 `GET /api/announcements`
返回 `body = { root: { children: [{ type: 'paragraph', … }] } }`——注意它不是字符串。
渲染走 `src/lib/richtext.ts` 的 `convertLexicalToHTML`。（「存的是 markdown」是
Directus 老版本的印象：那边 `body` 是 Markdown/HTML 混合文本，要 markdown-it 解析 +
DOMPurify 清洗；这版没有这条路，项目里也没有 markdown 依赖。）

之前只写了 `lexicalEditor()`——**不带工具条**，排版只能靠键盘和 markdown 式输入转换
（行首 `# ` 变标题、`**粗**` 变加粗），对不写 markdown 的人等于没有排版入口。现在开了两条：

- **FixedToolbarFeature**：编辑器顶部常驻一排按钮（加粗 / 斜体 / 下划线 / 删除线 /
  行内代码 / 上标下标 / 缩进 / 链接，以及「段落与标题」「对齐」「插入」三个下拉）。
- **InlineToolbarFeature**：选中文字时浮在选区上方。
- 标题只开 **H1–H3**：内容是卡片描述、公告正文、合规页，六级标题只会把下拉拉长。

两个 feature 都**不改数据结构，因此不需要迁移**。

**工具条按钮的名字是补上去的。** Payload 3.92 的工具条按钮只有图标
（`data-button-key="bold"`），既没有 `aria-label` 也没有 `title`——悬停无提示、读屏念「按钮」。
[RichTextToolbarLabels.tsx](../src/components/admin/RichTextToolbarLabels.tsx) 按 `data-button-key`
从一份三语小表里取名，写进 `aria-label` 与 `title`（工具条是聚焦才挂载的，用 MutationObserver 跟着，
带节流）。Payload 自带的 lexical 词典里没有这些按钮的文案，所以这份表是项目自己维护的。

## 6. 仪表盘为什么整屏换掉

Payload 默认那一屏是几组巨大的空卡片：一个方框、一个标题、一个「+」，
在 1440 宽的屏幕上大半页是空白，运营者扫一眼得不到任何信息。
现在这一屏回答运维真正会问的三件事：

1. **规模与积压**——卡牌 / 公告 / 待处理留言 / 门店 四个数
   （服务端用 Local API 现查，`overrideAccess` 绕过前台只读权限）；
2. **最近动过什么**——最近更新的 5 张卡牌，点名称直接进编辑页；
3. **还欠什么**——状态为「新」的留言，按时间倒序，点进去就是那条工单。

底部保留一份按分组排列的集合索引，承担原来卡片墙的导航职责，
但换成一行一条的紧凑列表，扫读时眼睛只走一条竖线。

## 7. shadcn 怎么用在这里

shadcn/ui 不是一个 npm 依赖，而是**把组件源码复制进仓库**：
`src/components/ui/*` 是标准 shadcn 组件（Radix + `cva` 变体 + `cn()` 合并类名），
改起来跟改自己的组件一样，也不需要引入整套设计系统。

新增依赖：`class-variance-authority`、`tailwind-merge`、`clsx`、`lucide-react`、
`@radix-ui/react-{slot,separator,tooltip,dropdown-menu}`。

## 8. 为什么这样实现（而不是改 Payload 源码 / 猜 class）

### 踩过的一个坑：后台样式的入口只能有一个

曾经把一套装饰样式拆成独立文件（从 `AdminProviders` 里 `import`）：dev 模式一切正常，
但**生产构建（Turbopack 与 webpack 都一样）会把它和 `admin-ui.css` 拆进一个没有被
/admin 页面 `<link>` 引用的 chunk**，登录页与仪表盘的样式整块消失——只看 dev 截图发现不了。
结论：后台自己的样式只走 `admin-ui.css` 这一个入口（`@import` 进同一 chunk）。
另外那个坑还叠了一层：端口上挂着旧 `next-server` 进程在服务已被删除的构建产物，
表现同样是「样式丢失」，先 `kill` 干净再下结论。


1. Payload 的主题是集中在 `:root` / `html[data-theme]` 上的 CSS 变量，覆盖变量即可全局生效；
2. 两个 CSS 文件都在 `@payloadcms/next/css` 之后加载、且未进 `@layer`——
   未分层样式的优先级高于 Payload 的 `@layer payload-default` 样式；
3. 有名字可依赖的都是我们自己写的类（`.admin-*`），升级 Payload 不会坏；
4. Tailwind 只引 `theme` 与 `utilities`：Payload 自带一整套重置与组件样式，
   再叠一层 preflight 会把按钮、边框、标题的默认样式一起抹掉；
5. 挂载点放在 `providers` 而不是 `app/(payload)/layout.tsx`——后者由 Payload 生成，
   升级时会被整份重写，写进去的 import 会静默消失。

## 9. 想调风格时改哪里

| 想改什么 | 改哪里 |
| --- | --- |
| 中性色阶（两套主题一起动） | `custom.scss` 第 2、3 节的 `--theme-elevation-*`；`admin-ui.css` 的 `--background` / `--card` / `--muted-foreground` |
| 强调色 | `custom.scss` 的 `--color-brand*`；`admin-ui.css` 的 `--primary-soft-fg` |
| 按钮浓度 | `custom.scss` 的 `--btn-solid-bg` / `--btn-tint-bg(-hover)` / `--btn-tint-fg` / `--btn-tint-border`（浅色在 `:root`、深色在 `html[data-theme='dark']`） |
| 侧栏这一列怎么排 | `custom.scss` 第 6 节的 `.admin-nav` / `.nav__link` / `.admin-nav__icon` |
| 侧栏顺序与图标 | `AdminNav.tsx`（顺序 = `payload.config.ts` 里的集合顺序）、`entity-meta.ts`（图标表） |
| 圆角 | `custom.scss` 的 `--style-radius-s/m/l`；`admin-ui.css` 的 `--r-*` |
| 三级表面（页面 / 栏 / 面板） | `custom.scss` 的 `--theme-bg` / `--rail-bg` / `--panel-bg`（浅色与深色各一套，方向都是「越靠内容越亮」） |
| 页面与表面的分离度 | `custom.scss` 的 `--theme-bg` / `--theme-border-color` / `--theme-input-bg` / `--theme-input-border` / `--focus-ring` |
| 状态胶囊的语义色 | `custom.scss` 的 `--status-published-{bg,fg}` / `--status-archived-{bg,fg}`；草稿走 `--theme-elevation-100/700` |
| 正文大小 / 留白 | `custom.scss` 第 1、4 节（`--base-px` / `--base-body-size` 不要动，那是 Payload 的间距基准） |
| 仪表盘分块与文案 | `DashboardView.tsx` |
| 组件外观 | `src/components/ui/*`（标准 shadcn 组件，可按上游同步更新） |
| 孟菲斯三色 / 装饰强度 / 彻底移除 | `admin-memphis.css` 顶部 `--memphis-*`；`.admin-dashboard::before` 与 `.admin-stat-strip > *::before`；整份删掉并去掉 admin-ui.css 顶部那条 `@import` 即可（其余零改动） |
| 后台默认主题 | `src/middleware.ts` 的 `DEFAULT_ADMIN_THEME` |
