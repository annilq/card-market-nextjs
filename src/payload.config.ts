import path from 'path'
import { fileURLToPath } from 'url'

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

import { Announcements } from '@/collections/Announcements'
import { Banners } from '@/collections/Banners'
import { Cards } from '@/collections/Cards'
import { InfoPages } from '@/collections/InfoPages'
import { Ips } from '@/collections/Ips'
import { Media } from '@/collections/Media'
import { Messages } from '@/collections/Messages'
import { Rarities } from '@/collections/Rarities'
import { Series } from '@/collections/Series'
import { Shops } from '@/collections/Shops'
import { SubSeries } from '@/collections/SubSeries'
import { Users } from '@/collections/Users'
import { SiteSettings } from '@/globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

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
    // 后台默认深色（新访客的 payload-theme cookie 由 src/middleware.ts 种下），
    // 但仍保留「跟随系统 / 手动切换」两条路，所以这里不写死成 'dark'。
    theme: 'all',
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
      // 侧栏换成自定义的一级菜单：集合与全局平铺，不再按 admin.group 折成二级
      Nav: '@/components/admin/AdminNav#AdminNav',
      views: {
        // 替换默认的「集合卡片墙」：规模 / 最近更新 / 待处理留言 / 集合索引
        dashboard: { Component: '@/components/admin/DashboardView#DashboardView' },
      },
    },
  },
  collections: [
    Users,
    Media,
    Ips,
    Series,
    SubSeries,
    Rarities,
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
  serverURL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3100',
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
            // 浏览器直传桶，绕开 Vercel serverless 4.5MB 请求体上限（后台上传大图用）
            clientUploads: true,
            config: {
              endpoint: process.env.S3_ENDPOINT || undefined,
              region: process.env.S3_REGION || 'auto',
              credentials: {
                accessKeyId: process.env.S3_KEY ?? '',
                secretAccessKey: process.env.S3_SECRET ?? '',
              },
            },
          }),
        ]
      : []),
  ],
})
