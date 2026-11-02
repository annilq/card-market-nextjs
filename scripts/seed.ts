// 种子数据（演示用）：维度、卡牌、banner、公告、信息页、门店、站点设置、一条留言。
// 与 Directus 版本的差别：那边是「HTTP + admin token 打到另一个容器」；
// 这里是同一个 Node 进程里直接调 Payload Local API，没有 HTTP、没有 token、没有 CORS。
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import configPromise from '@payload-config'
import { getPayload, type Payload } from 'payload'

const SOURCE = '/Users/annilq/Documents/develop/card-market'
const ADMIN_EMAIL = 'admin@example.com'
const ADMIN_PASSWORD = 'admin12345'

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

async function uploadImage(payload: Payload, filePath: string, alt: string) {
  const buffer = await readFile(filePath)
  return payload.create({
    collection: 'media',
    data: { alt },
    file: {
      data: buffer,
      mimetype: filePath.endsWith('.png') ? 'image/png' : 'image/jpeg',
      name: path.basename(filePath),
      size: buffer.byteLength,
    },
  })
}

async function main() {
  const payload = await getPayload({ config: configPromise })

  // 管理员账号（幂等）
  const existingUsers = await payload.find({ collection: 'users', limit: 1, overrideAccess: true })
  if (existingUsers.docs.length === 0) {
    await payload.create({
      collection: 'users',
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: '管理员' },
    })
    console.log(`+ 管理员：${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  }

  const existingIps = await payload.find({ collection: 'ips', limit: 1, overrideAccess: true })
  if (existingIps.docs.length > 0) {
    console.log('· 已存在种子数据（ips 非空），跳过内容写入。需要重置请跑 npm run reinit。')
    return
  }

  console.log('· 上传示例图片…')
  // 注意：种子图必须用「真正的卡面图」。不能随手拿 uploads 里的文件——
  // 之前误用了 7321f987….jpg，那是一张真实人物照片，用它当卡图既不合适也涉及隐私。
  // 这里用源站公开页面实际在用的卡面（皮卡丘，172×241）。
  const cardImage = await uploadImage(
    payload,
    path.join(SOURCE, 'directus/uploads/abfe3291-78e5-4f3a-91a8-e8e6ec881748.png'),
    '示例卡牌图：皮卡丘',
  )
  const logo = await uploadImage(
    payload,
    path.join(SOURCE, 'src/asserts/icon/logo_header.png'),
    'card-market logo',
  )

  // 维度：IP → 系列 → 子系列
  const pokemon = await payload.create({ collection: 'ips', data: { name: '宝可梦', sort: 1, enabled: true } })
  const yugioh = await payload.create({ collection: 'ips', data: { name: '游戏王', sort: 2, enabled: true } })
  const dragonball = await payload.create({ collection: 'ips', data: { name: '龙珠', sort: 3, enabled: true } })

  const scarlet = await payload.create({ collection: 'series', data: { name: '朱紫', ip: pokemon.id, sort: 1 } })
  const sword = await payload.create({ collection: 'series', data: { name: '剑盾', ip: pokemon.id, sort: 2 } })
  const mainYg = await payload.create({ collection: 'series', data: { name: '主力系列', ip: yugioh.id, sort: 1 } })
  const dbMain = await payload.create({ collection: 'series', data: { name: '主力系列', ip: dragonball.id, sort: 1 } })

  const scarletA = await payload.create({ collection: 'sub-series', data: { name: '朱紫A', series: scarlet.id, sort: 1 } })
  const swordA = await payload.create({ collection: 'sub-series', data: { name: '剑盾A', series: sword.id, sort: 1 } })
  const ygA = await payload.create({ collection: 'sub-series', data: { name: '游戏王A', series: mainYg.id, sort: 1 } })
  // 只有两层的 IP 也要建空壳子系列，否则组合唯一键里会出现 NULL
  const dbA = await payload.create({ collection: 'sub-series', data: { name: '（通用）', series: dbMain.id, sort: 1 } })

  const ssr = await payload.create({ collection: 'rarities', data: { name: 'SSR', sort: 1 } })
  const ur = await payload.create({ collection: 'rarities', data: { name: 'UR', sort: 2 } })
  const hr = await payload.create({ collection: 'rarities', data: { name: 'HR', sort: 3 } })
  const n = await payload.create({ collection: 'rarities', data: { name: 'N', sort: 4 } })

  // 卡牌
  const cardDefs = [
    { name: '皮卡丘', ip: pokemon.id, series: scarlet.id, sub: scarletA.id, r: hr.id, code: '197/197', price: 120, hv: true },
    { name: '喷火龙', ip: pokemon.id, series: scarlet.id, sub: scarletA.id, r: ur.id, code: '199/197', price: 880, hv: true },
    { name: '妙蛙种子', ip: pokemon.id, series: sword.id, sub: swordA.id, r: n.id, code: '001/098', price: 35, hv: false },
    { name: '黑魔导', ip: yugioh.id, series: mainYg.id, sub: ygA.id, r: ur.id, code: 'EN001', price: 240, hv: true },
    { name: '青眼白龙', ip: yugioh.id, series: mainYg.id, sub: ygA.id, r: ssr.id, code: 'EN002', price: 560, hv: false },
    { name: '孙悟空', ip: dragonball.id, series: dbMain.id, sub: dbA.id, r: ssr.id, code: 'DB-001', price: 320, hv: false },
  ]
  let blueEyesId: number | null = null
  for (const card of cardDefs) {
    const created = await payload.create({
      collection: 'cards',
      data: {
        name: card.name,
        ip: card.ip,
        series: card.series,
        subSeries: card.sub,
        rarity: card.r,
        code: card.code,
        price: card.price,
        isHighValue: card.hv,
        cardStatus: 'raw',
        status: 'published',
        images: [cardImage.id],
        description: lexical([
          { type: 'p', text: `${card.name} 示例卡牌，裸卡状态，支持回购咨询。` },
        ]),
      },
    })
    if (card.name === '青眼白龙') blueEyesId = created.id
  }
  console.log(`+ 卡牌：${cardDefs.length} 张`)

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

  const future = new Date(Date.now() + 7 * 864e5).toISOString()
  await payload.create({
    collection: 'announcements',
    data: {
      title: '店铺春节营业时间调整',
      body: lexical([{ type: 'p', text: '春节期间营业时间调整为 10:00–18:00，敬请留意。' }]),
      isPinned: true,
      sort: 1,
      status: 'published',
    },
  })
  await payload.create({
    collection: 'announcements',
    data: {
      title: '游戏王高罕卡专项回收启动',
      body: lexical([{ type: 'p', text: '即日起开放游戏王 UR/SSR 高价回收，欢迎留言估价。' }]),
      isPinned: false,
      sort: 2,
      status: 'published',
    },
  })
  await payload.create({
    collection: 'announcements',
    data: {
      title: '（预告）线下卡牌交流会展位预告',
      body: lexical([{ type: 'p', text: '将于下月参与线下展会，详情稍后公布。' }]),
      publishedAt: future, // 定时发布：到点前前台看不到
      isPinned: false,
      sort: 3,
      status: 'published',
    },
  })

  // 门店（geo 由钩子镜像到 lat / lng）
  await payload.create({
    collection: 'shops',
    data: {
      name: 'card-market · 秋叶原本店',
      address: '东京都千代田区外神田 1-1 示例大楼 3F',
      geo: { lat: 35.6995, lng: 139.7717 },
      phone: '03-1234-5678',
      businessHours: '11:00–20:00（周一休）',
      description: '宝可梦 / 游戏王 / 龙珠等全品类高价回购，鉴定速度快，支持现场结算。',
      sort: 1,
      status: 'published',
    },
  })
  await payload.create({
    collection: 'shops',
    data: {
      name: 'card-market · 涩谷店',
      address: '东京都涩谷区涩谷 2-2 示例大厦 1F',
      geo: { lat: 35.6595, lng: 139.7004 },
      phone: '03-2345-6789',
      businessHours: '12:00–21:00（不定休）',
      description: '主打高罕卡专项回收，UR/SSR 估价优厚。',
      sort: 2,
      status: 'published',
    },
  })
  await payload.create({
    collection: 'shops',
    data: {
      name: 'card-market · 池袋店（草稿示例）',
      address: '东京都丰岛区池袋 3-3 示例大楼 2F',
      geo: { lat: 35.7295, lng: 139.7109 },
      businessHours: '12:00–20:00',
      sort: 3,
      status: 'draft', // 演示：草稿门店不出现在前台
    },
  })

  // 审核信息页
  const infoPages: { key: 'operation' | 'personal-info' | 'terms' | 'data-usage'; title: string; blocks: Block[] }[] = [
    {
      key: 'operation',
      title: '运营信息',
      blocks: [
        { type: 'h2', text: '运营主体' },
        { type: 'p', text: '本网站由 card-market 运营，提供卡牌展示、回购咨询与门店信息服务。' },
        { type: 'h2', text: '联系方式' },
        { type: 'p', text: '客服邮箱：shop@example.com。营业日通常在 1 个工作日内回复。' },
        { type: 'h2', text: '免责声明' },
        { type: 'p', text: '网站展示的卡牌信息、价格与库存仅供参考，实际以门店鉴定与确认为准。' },
      ],
    },
    {
      key: 'personal-info',
      title: '个人信息收集',
      blocks: [
        { type: 'h2', text: '收集范围' },
        { type: 'p', text: '留言表单会收集您主动填写的留言内容、联系人姓名与联系方式。联系人为选填项。' },
        { type: 'h2', text: '收集目的' },
        { type: 'p', text: '仅用于回复您的咨询、处理回购请求与改进服务，不用于任何营销推送。' },
      ],
    },
    {
      key: 'terms',
      title: '利用规则',
      blocks: [
        { type: 'h2', text: '网站使用' },
        { type: 'p', text: '访问本网站即表示您同意遵守本规则。请勿以爬虫、批量抓取等方式对本站造成负担。' },
        { type: 'h2', text: '禁止行为' },
        { type: 'p', text: '禁止提交违法、侵权、辱骂或垃圾信息。违反者我们有权删除内容并限制访问。' },
      ],
    },
    {
      key: 'data-usage',
      title: '数据使用',
      blocks: [
        { type: 'h2', text: '数据用途' },
        { type: 'p', text: '本站收集的留言数据仅用于咨询回复与回购业务处理，不对外出售或共享给第三方。' },
        { type: 'h2', text: 'Cookie 与本地存储' },
        { type: 'p', text: '本站仅使用浏览器本地存储保存界面语言与深色模式偏好，不做跨站跟踪。' },
      ],
    },
  ]
  for (const page of infoPages) {
    await payload.create({
      collection: 'info-pages',
      data: { pageKey: page.key, title: page.title, body: lexical(page.blocks), status: 'published' },
    })
  }

  await payload.updateGlobal({
    slug: 'site-settings',
    data: {
      siteName: 'card-market',
      logo: logo.id,
      intro: '专注宝可梦 / 游戏王 / 龙珠等卡牌展示与高价回购。',
      xAccount: '@cardmarket',
      contactEmail: 'shop@example.com',
      businessHours: '11:00–20:00',
      dataNotice: lexical([{ type: 'p', text: '本站展示数据仅供鉴赏，交易以实际鉴定为准。' }]),
      privacyPolicy: lexical([{ type: 'p', text: '我们仅将联系方式用于回复您的咨询。' }]),
    },
  })

  if (blueEyesId) {
    await payload.create({
      collection: 'messages',
      data: {
        content: '想咨询青眼白龙的回收价格，谢谢！',
        contactName: '田中',
        contactInfo: 'tanaka@example.com',
        card: blueEyesId,
        status: 'new',
      },
    })
  }

  console.log('✅ 种子数据完成：维度 / 卡牌 / banner / 公告 / 门店 / 信息页 / 站点设置 / 一条留言')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ seed 失败：', error)
    process.exit(1)
  })
