// 种子数据（模板用）：角色/管理员账号 + 每种业务类型各一条「字段最全」的示例，
// 方便照着改。与 Directus 版本的差别：那边是「HTTP + admin token 打到另一个容器」；
// 这里是同一个 Node 进程里直接调 Payload Local API，没有 HTTP、没有 token、没有 CORS。
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import configPromise from '@payload-config'
import { getPayload, type Payload } from 'payload'

import { MODULES } from '../src/access/roles'

const ADMIN_EMAIL = 'admin@koduckya.com'
const ADMIN_PASSWORD = 'koduckya'

/** 当前项目 public/ 下的同名 logo，与脚本位置绑定，不依赖运行时工作目录。 */
const LOGO_PATH = fileURLToPath(new URL('../public/logo_header.png', import.meta.url))

/** 一张简单的纯灰占位图（120×168 灰度 PNG），用 base64 内联，免去外部图片依赖。 */
const GRAY_PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAHgAAACoCAAAAAAOMXUhAAAAYUlEQVR42u3NMQ0AAAwDoPoXUa01sWQPGCB9ErFYLBaLxWKxWCwWi8VisVgsFovFYrFYLBaLxWKxWCwWi8VisVgsFovFYrFYLBaLxWKxWCwWi8VisVgsFovFYrFYLBaL7w2JsZ1Rmk/LGwAAAABJRU5ErkJggg=='

type Block = { type: 'h2' | 'p'; text: string }

/** 富文本在 Payload 里是 Lexical 的结构化 JSON，不再是任意 HTML 字符串。 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function lexical(blocks: Block[]): any {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: blocks.map((block) => ({
        type: block.type === 'h2' ? 'heading' : 'paragraph',
        ...(block.type === 'h2' ? { tag: 'h2' } : {}),
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
          {
            type: 'text',
            format: 0,
            detail: 0,
            mode: 'normal',
            style: '',
            text: block.text,
            version: 1,
          },
        ],
      })),
    },
  }
}

type SeedFile = { data: Buffer; name: string; mimetype: string }

/** 从内存里的文件描述符上传一张图片到 media 集合（不依赖磁盘上的源文件）。 */
async function uploadImage(payload: Payload, file: SeedFile, alt: string) {
  return payload.create({
    collection: 'media',
    data: { alt },
    file: { ...file, size: file.data.byteLength },
  })
}

async function main() {
  const payload = await getPayload({ config: configPromise })

  // 角色（幂等，先于内容写入）：
  //  - 「管理员」：带 isAdmin 标志的特殊角色，默认拥有全部权限；
  //  - 「运营」：普通角色，默认对所有模块有查看 / 新增 / 编辑 / 删除权限，
  //    让新建用户始终有可选角色（避免死胡同）。
  // 这两条属于系统初始化，不是演示数据，保留。
  const adminRoleRes = await payload.find({
    collection: 'roles',
    where: { isAdmin: { equals: true } },
    limit: 1,
    overrideAccess: true,
  })
  let adminRoleId = adminRoleRes.docs[0]?.id
  if (!adminRoleId) {
    const created = await payload.create({
      collection: 'roles',
      overrideAccess: true,
      data: { name: '管理员', isAdmin: true },
    })
    adminRoleId = created.id
    console.log('+ 角色：管理员')
  }

  const allModulePerms = MODULES.map((m) => ({
    module: m.slug,
    view: true,
    create: true,
    update: true,
    delete: true,
  }))
  const operatorRoleRes = await payload.find({
    collection: 'roles',
    where: { name: { equals: '运营' } },
    limit: 1,
    overrideAccess: true,
  })
  if (operatorRoleRes.docs.length === 0) {
    await payload.create({
      collection: 'roles',
      overrideAccess: true,
      data: { name: '运营', isAdmin: false, permissions: allModulePerms },
    })
    console.log('+ 角色：运营（默认全模块可读可写）')
  }

  // 管理员账号（幂等）
  const existingUsers = await payload.find({ collection: 'users', limit: 1, overrideAccess: true })
  if (existingUsers.docs.length === 0) {
    await payload.create({
      collection: 'users',
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: '管理员', role: adminRoleId as number },
    })
    console.log(`+ 管理员：${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  }

  // 兜底：确保管理员账号绑定管理员角色（首用户钩子会处理新建场景，这里是旧库补绑）。
  if (adminRoleId) {
    const adminUsers = await payload.find({
      collection: 'users',
      where: { email: { equals: ADMIN_EMAIL } },
      limit: 1,
      overrideAccess: true,
    })
    const u = adminUsers.docs[0]
    if (u && u.role !== adminRoleId && (u.role as { id?: unknown })?.id !== adminRoleId) {
      await payload.update({
        collection: 'users',
        id: u.id,
        data: { role: adminRoleId },
        overrideAccess: true,
      })
    }
  }

  const existingIps = await payload.find({ collection: 'ips', limit: 1, overrideAccess: true })
  if (existingIps.docs.length > 0) {
    console.log('· 已存在种子数据（ips 非空），跳过内容写入。需要重置请跑 npm run reinit。')
    return
  }

  console.log('· 上传示例图片…')
  // 卡牌图：纯灰 base64 占位图，无需任何外部图片文件。
  const cardImage = await uploadImage(
    payload,
    {
      data: Buffer.from(GRAY_PLACEHOLDER_PNG_BASE64, 'base64'),
      name: 'card-placeholder.png',
      mimetype: 'image/png',
    },
    '示例卡牌图：灰色占位图',
  )
  // Logo：直接用当前项目 public/ 下的同名文件。
  const logo = await uploadImage(
    payload,
    {
      data: await readFile(LOGO_PATH),
      name: 'logo_header.png',
      mimetype: 'image/png',
    },
    'koduckya logo',
  )

  // ── 以下每种业务类型只建一条「字段最全」的记录，作为可直接修改的模板 ──
  // 说明：派生 / 计算字段（cards.dedupeKey、shops.lat / lng、各集合的 publicLink）
  // 由钩子或 UI 生成，不需要也不应手填，故下面不列出。

  // 维度：IP → 系列 → 子系列（外加稀有度）
  const ip = await payload.create({
    collection: 'ips',
    data: { name: '宝可梦', sort: 1, enabled: true },
  })
  const series = await payload.create({
    collection: 'series',
    data: { name: '朱紫', ip: ip.id, sort: 1, enabled: true },
  })
  const subSeries = await payload.create({
    collection: 'sub-series',
    data: { name: '朱紫A', series: series.id, sort: 1, enabled: true },
  })
  const rarity = await payload.create({
    collection: 'rarities',
    data: { name: 'SSR', sort: 1, enabled: true },
  })

  // 卡牌
  await payload.create({
    collection: 'cards',
    data: {
      name: '皮卡丘',
      ip: ip.id,
      series: series.id,
      subSeries: subSeries.id,
      rarity: rarity.id,
      code: '197/197',
      price: 120,
      images: [cardImage.id],
      description: lexical([{ type: 'p', text: '皮卡丘示例卡牌，裸卡状态，支持回购咨询。' }]),
      isHighValue: true,
      cardStatus: 'raw',
      status: 'published',
    },
  })

  // 首页轮播 banner
  await payload.create({
    collection: 'banners',
    data: {
      title: '新到宝可梦 151 全图鉴',
      description: '限时回购高价回收，欢迎咨询',
      image: cardImage.id,
      link: '/cards',
      sort: 1,
      status: 'published',
    },
  })

  // 公告（publishedAt 留空或过去 = 立即展示，未来时间 = 定时发布）
  await payload.create({
    collection: 'announcements',
    data: {
      title: '店铺春节营业时间调整',
      body: lexical([{ type: 'p', text: '春节期间营业时间调整为 10:00–18:00，敬请留意。' }]),
      publishedAt: new Date(Date.now() - 864e5).toISOString(),
      isPinned: true,
      sort: 1,
      status: 'published',
    },
  })

  // 门店（lat / lng 由 beforeChange 钩子从 geo 自动镜像，不必手填）
  await payload.create({
    collection: 'shops',
    data: {
      name: 'koduckya · 秋叶原本店',
      address: '东京都千代田区外神田 1-1 示例大楼 3F',
      geo: { lat: 35.6995, lng: 139.7717 },
      businessHours: '11:00–20:00（周一休）',
      phone: '03-1234-5678',
      image: cardImage.id,
      description: '宝可梦 / 游戏王 / 龙珠等全品类高价回购，鉴定速度快，支持现场结算。',
      sort: 1,
      status: 'published',
    },
  })

  // 审核信息页（pageKey 为固定枚举，见 InfoPages.ts；这里挑一条字段最全的）
  await payload.create({
    collection: 'info-pages',
    data: {
      pageKey: 'operation',
      title: '运营信息',
      body: lexical([
        { type: 'h2', text: '运营主体' },
        { type: 'p', text: '本网站由 koduckya 运营，提供卡牌展示、回购咨询与门店信息服务。' },
        { type: 'h2', text: '联系方式' },
        { type: 'p', text: '客服邮箱：shop@example.com。营业日通常在 1 个工作日内回复。' },
      ]),
      sort: 1,
      status: 'published',
    },
  })

  // 站点设置（全局，含全部字段）
  await payload.updateGlobal({
    slug: 'site-settings',
    data: {
      siteName: 'koduckya',
      logo: logo.id,
      intro: '专注宝可梦 / 游戏王 / 龙珠等卡牌展示与高价回购。',
      xAccount: '@koduckya',
      contactEmail: 'shop@example.com',
      contactPhone: '03-1234-5678',
      businessHours: '11:00–20:00',
      shopAddress: '东京都千代田区外神田 1-1 示例大楼 3F',
      dataNotice: lexical([{ type: 'p', text: '本站展示数据仅供鉴赏，交易以实际鉴定为准。' }]),
      privacyPolicy: lexical([{ type: 'p', text: '我们仅将联系方式用于回复您的咨询。' }]),
    },
  })

  console.log('✅ 种子数据完成：角色 / 管理员 / 维度 / 卡牌 / banner / 公告 / 门店 / 信息页 / 站点设置')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ seed 失败：', error)
    process.exit(1)
  })
