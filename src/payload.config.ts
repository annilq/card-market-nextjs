import path from 'path'
import { fileURLToPath } from 'url'

import type { S3ClientConfig } from '@aws-sdk/client-s3'
import { postgresAdapter } from '@payloadcms/db-postgres'
import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { en } from '@payloadcms/translations/languages/en'
import { ja } from '@payloadcms/translations/languages/ja'
import { zh } from '@payloadcms/translations/languages/zh'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { migrations } from './migrations'
import { Announcements } from '@/collections/Announcements'
import { Banners } from '@/collections/Banners'
import { Cards } from '@/collections/Cards'
import { CardStatuses } from '@/collections/CardStatuses'
import { InfoPages } from '@/collections/InfoPages'
import { Ips } from '@/collections/Ips'
import { Media } from '@/collections/Media'
import { Messages } from '@/collections/Messages'
import { Rarities } from '@/collections/Rarities'
import { Roles } from '@/collections/Roles'
import { Series } from '@/collections/Series'
import { Shops } from '@/collections/Shops'
import { SubSeries } from '@/collections/SubSeries'
import { Users } from '@/collections/Users'
import { SiteSettings } from '@/globals/SiteSettings'
import { b2ClientUploadsPlugin } from '@/lib/s3/b2-client-uploads'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// S3 / B2 客户端配置：s3Storage 与 B2 兼容插件必须共用同一份 endpoint / region /
// credentials，否则重签出的 URL 与浏览器实际请求的签名对不上。
// requestHandler 必须显式带上 s3Storage 默认的 agent 选项：插件把 config 展开在
// 默认 requestHandler 之后，这里一旦提供就会整体替换，漏写会把连接池从 100 降到 50。
// B2 偶发在 TCP 连上后吞掉 TLS 握手，而默认 handler 没有请求级 deadline，单次挂起
// 约 120s；requestTimeout + throwOnRequestTimeout 把它压成可重试的 TimeoutError。
// 回读原图与回传四个产物都用这份缓存客户端，一处配置即可覆盖两处挂点。
const s3Config: S3ClientConfig = {
  endpoint: process.env.S3_ENDPOINT || undefined,
  region: process.env.S3_REGION || 'auto',
  credentials: {
    accessKeyId: process.env.S3_KEY ?? '',
    secretAccessKey: process.env.S3_SECRET ?? '',
  },
  requestHandler: {
    httpAgent: { keepAlive: true, maxSockets: 100 },
    httpsAgent: { keepAlive: true, maxSockets: 100 },
    requestTimeout: 8000,
    throwOnRequestTimeout: true,
    socketTimeout: 10000,
  },
}

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: '卡牌回购站 | Payload',
      // public/ 下已有从原项目复制的图标
      icons: { icon: '/favicon.ico' },
      openGraph: { images: ['/logo_header.png'] },
    },
    importMap: { baseDir: path.resolve(dirname) },
    dateFormat: 'yyyy-MM-dd HH:mm',
    // 后台默认浅色（新访客的 payload-theme cookie 由 src/middleware.ts 种下），
    // 但仍保留「跟随系统 / 手动切换」两条路，所以这里不写死成 'light'。
    // 写死成 'light' 会让 getRequestTheme 直接忽略 cookie，顶栏切换按钮会失效。
    theme: 'all',
    // 账户头像：默认是 gravatar（按邮箱去 gravatar.com 取图，内网/离线常裂图且无兜底）。
    // 改成自定义组件——优先显示用户在「账户」页上传的头像，失败/没传则退回首字母圆，绝不裂图。
    avatar: { Component: '@/components/admin/AdminAccountAvatar#AdminAccountAvatar' },
    components: {
      // 标识：登录页大 Logo + 导航小图标（同一枚「卡堆」标记）
      graphics: {
        Logo: '@/components/admin/Brand#AdminLogo',
        Icon: '@/components/admin/Brand#AdminIcon',
      },
      // 载入 admin-ui.css（shadcn 令牌 + Tailwind 工具类）与 Tooltip Provider。
      // 挂在 providers 而不是改 layout.tsx——那份文件由 Payload 生成，升级会重写。
      providers: ['@/components/admin/AdminProviders#AdminProviders'],
      // 登录页标题（原来的四色条已删，只留站名）
      beforeLogin: ['@/components/admin/LoginIntro#LoginIntro'],
      // 顶栏右侧 actions 区：把「后台深色模式切换」从账户下拉里拎出来，直接放右上角。
      // 注意这是后台主题（data-theme + payload-theme cookie），与前台 dark class 无关。
      actions: ['@/components/admin/AdminThemeToggle#AdminThemeToggle'],
      // 侧栏换成自定义的一级菜单：集合与全局平铺，不再按 admin.group 折成二级
      Nav: '@/components/admin/AdminNav#AdminNav',
      views: {
        // 替换默认的「集合卡片墙」：规模 / 最近更新 / 待处理留言 / 集合索引
        dashboard: { Component: '@/components/admin/DashboardView#DashboardView' },
        // 帮助页：/admin/help，侧栏有入口。给运营的一份操作说明。
        help: {
          Component: '@/components/admin/HelpView#HelpView',
          path: '/help',
          meta: { title: '后台操作帮助' },
        },
        bulkCards: {
          Component: '@/components/admin/bulk-cards/BulkCardsView#BulkCardsView',
          path: '/bulk-cards',
          exact: true,
          meta: { title: '批量上架' },
        },
      },
    },
  },
  collections: [
    Users,
    Roles,
    Media,
    Ips,
    Series,
    SubSeries,
    Rarities,
    CardStatuses,
    Cards,
    Banners,
    Announcements,
    InfoPages,
    Shops,
    Messages,
  ],
  globals: [SiteSettings],
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URI ?? '' },
    // 关掉 dev 模式的自动 schema push：它会把不在 Payload 模型里的数据库对象一并删掉
    // （实测：手建的 pg_trgm GIN 索引在每次 dev 启动后被 DROP）。
    // 关掉之后，schema 变更一律走 `payload migrate:create && payload migrate`。
    push: false,
    // 关键：把迁移数组挂到 postgresAdapter 的 prodMigrations 上。
    // 否则生产环境（NODE_ENV=production）启动时 connect.js 里的
    // `if (NODE_ENV==='production' && this.prodMigrations) migrate(...)` 永远为假，
    // 迁移不会执行，Users.avatar 需要的 users.avatar_id 列就一直不存在 ——
    // 后台一查 users 表就报 "column users.avatar_id does not exist"，
    // SSR 抛错后浏览器侧表现为 React #441（后台进不去）。
    // 挂上后，Vercel 的 serverless 冷启动会自动跑一遍尚未应用的迁移（幂等）。
    prodMigrations: migrations,
  }),
  /*
   * 富文本编辑器：Lexical（所见即所得），**内容存的是结构化 JSON，不是 markdown**
   * （渲染见 src/lib/richtext.ts：convertLexicalToHTML）。
   *
   * 之前只写了 `lexicalEditor()`——不带工具条，排版只能靠键盘和 markdown 式的
   * 输入转换（行首 `# ` 变标题、`**粗**` 变加粗），对不写 markdown 的人等于没有排版入口。
   * 现在加两条常驻工具条：
   *   - FixedToolbarFeature：编辑器顶部常驻一排按钮（加粗 / 斜体 / 下划线 / 删除线 /
   *     行内代码 / 段落与标题下拉 / 引用 / 有序无序列表 / 链接 / 对齐 / 缩进 / 分割线）。
   *   - InlineToolbarFeature：选中文字时浮在选区上方（改几个字不用把手移到顶部）。
   *
   * 标题只开 H1–H3：运营内容是卡片描述、公告正文、合规页，六级标题只会让下拉变长。
   * 这两个 feature 都不改数据结构，因此**不需要迁移**。
   */
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      FixedToolbarFeature(),
      InlineToolbarFeature(),
      HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3'] }),
    ],
  }),
  secret: process.env.PAYLOAD_SECRET ?? '',
  sharp,
  // serverURL 是后台 /admin 与媒体 URL 的主机基址。
  // 关键决策（根治「后台空白/跨域」与「登录成功却跳回登录页」）：
  //   - 生产（Vercel 注入 VERCEL=1，或自托管 standalone 的 NODE_ENV=production）：
  //     **刻意留空**。Payload 在 serverURL 为空时会改用相对路径
  //     （formatAdminURL: !serverURL → 返回相对 path），admin 前端与媒体 URL
  //     都按「用户实际访问的域名」同源解析，不依赖任何域名变量。
  //     更关键的是 cookie 鉴权：serverURL 非空时，sanitize 会把它塞进 config.csrf
  //     （config/sanitize.js），而 auth/extractJWT.js 对每个带 payload-token 的请求
  //     都要求 Origin 或 Sec-Fetch-Site 与 csrf 匹配。后台登录后的 RSC 导航请求
  //     `GET /admin?_rsc=...` 实测两者都不带（headful Chrome 抓包确认）→ 鉴权被判空
  //     → 307 回 /admin/login，表现即「登录成功却进不去」。留空后 csrf 为空数组，
  //     extractJWT 直接采信同源 cookie，链路闭环。
  //   - 本地 dev：回退 localhost:3100，保证本地 SSR 的媒体绝对 URL 正确。
  //     这里不能用 NEXT_PUBLIC_SITE_URL：它指向生产主域名，会让 csrf 只认生产 Origin，
  //     浏览器带 Origin 的同源 POST（cookie 鉴权）在本地被拒绝成 403。
  // 注意：绝不能用 VERCEL_URL 兜底——它指向「每次部署专属域名」，与用户访问的主域名不是同一 host。
  serverURL:
    process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
      ? ''
      : process.env.SITE_URL || 'http://localhost:3100',
  // 后台界面语言：默认中文（src/middleware.ts 把 /admin 请求的 Accept-Language 归一为 zh）。
  // 保留 en / ja，运营仍可在「账户 → 设置」里手动切换（写入 payload-lng cookie，优先级最高）。
  // 注意 fallbackLanguage 只是兜底，不是默认值：只要 supportedLanguages 里有 ja / en，
  // 日文 / 英文浏览器的 Accept-Language 就会直接命中，中文浏览器才会走到 zh。
  i18n: { supportedLanguages: { en, ja, zh }, fallbackLanguage: 'zh' },
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  graphQL: { schemaOutputFile: path.resolve(dirname, '../schema.graphql') },
  // 上传：默认写本地 media/ 目录；配了 S3_* 就走 S3 兼容对象存储（R2 / S3 / Spaces）。
  // Serverless（Vercel / Lambda）必须走 S3——那里的文件系统是临时的。
  plugins: [
    ...(process.env.S3_BUCKET
      ? [
          s3Storage({
            collections: { media: { prefix: 'media' } },
            bucket: process.env.S3_BUCKET,
            // 私有桶 + 签名下载：/api/media/file/<filename> 由服务端签发临时 URL 并 302 重定向给浏览器，
            // 因此桶无需设为 Public、也无需绑定信用卡。clientUploads 的直传本身就是签名 URL，不受影响。
            signedDownloads: true,
            // 浏览器直传桶，绕开 Vercel serverless 4.5MB 请求体上限（后台上传大图用）
            clientUploads: true,
            config: s3Config,
          }),
          // B2 的 S3 兼容 API 不实现条件写（If-None-Match），而 Payload 为修
          // CVE-2026-105867 会把它硬编码进 clientUploads 的预签名 PUT。
          // 这个插件包住签发端点，用同一个对象 Key 重签一张不带该头的 URL。
          // 它自带 order: 1，排在 s3Storage（0）之后才看得到端点；内部会检测
          // 上游是否仍在签 if-none-match，上游修好即自动空转。详见该文件注释。
          b2ClientUploadsPlugin({
            bucket: process.env.S3_BUCKET,
            config: s3Config,
          }),
        ]
      : []),
  ],
})
