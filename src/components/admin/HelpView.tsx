import { Gutter, Link } from '@payloadcms/ui'
import { Image as ImageIcon, Link2, MousePointerClick } from 'lucide-react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import React from 'react'
import type { AdminViewServerProps } from 'payload'

import { getOrigin } from '@/lib/site-url'
import { explainLinkPatterns } from '@/lib/admin/public-links'

import './admin-ui.css'

/**
 * 后台帮助页（/admin/help）。给运营的一份操作说明，内容是这一版后台里
 * 最容易出错的几处：怎么拿链接、图片该多大、状态与发布、编号唯一、排序、
 * alt、删除、语言。
 *
 * 链接示例从 public-links.ts 的同一张登记表生成，改路由时这里跟着变，
 * 不会写死一份对不上的清单。
 */

type Step = { body: string; title: string }
type Section = { body?: string; id: string; intro?: string; steps?: Step[]; title: string }

function buildSections(origin: string): { examples: { example: string; label: string }[]; sections: Section[] } {
  const examples = explainLinkPatterns(origin)
  const cardExample = `${origin}/cards/123`

  const sections: Section[] = [
    {
      id: 'links',
      title: '怎样添加跳转链接',
      intro:
        'banner 的「跳转链接」是手填的文本框，后台不会校验。填的时候请用站内路径（以 / 开头），不要带域名。前台会自动给日语站补 /ja、给英语站补 /en，所以同一条链接三种语言都能用，不需要建三条。',
      steps: [
        {
          title: '方法一：去列表页复制',
          body: '打开卡牌、公告、门店或信息页的列表。找到目标那一行，点「链接」列的小胶囊，会展开这台条目的前台路径和一顆复制按钮。点复制，回到 banner 表单粘进「跳转链接」。',
        },
        {
          title: '方法二：打开详情页复制',
          body: `点进任意一条记录，浏览器地址栏里 .../admin/collections/cards/123 的最后一段数字就是它的 id。前台详情页就是 ${cardExample} 这样的形式。`,
        },
        {
          title: '外部链接',
          body: '要跳到别的网站，直接填完整地址，例如 https://example.com。以 http 开头的地址不会被补语言段。',
        },
      ],
    },
    {
      id: 'patterns',
      title: '有哪些链接可填',
      intro: '下面是这个站前台存在的全部页面。带数字 id 的，把 id 换成你的记录 id 即可。',
    },
    {
      id: 'filters',
      title: '指向「筛好的列表」',
      intro:
        '卡牌列表 /cards 的筛选结果也能直接作为链接。筛选条件写在问号后面，多个用 & 连接。常用的几个：',
      steps: [
        { title: '按 IP', body: `${origin}/cards?ip=3` },
        { title: '按系列 + 排序', body: `${origin}/cards?series=5&sort=price_asc` },
        { title: '只看高价买取', body: `${origin}/cards?hv=1` },
        { title: '价格区间', body: `${origin}/cards?min=1000&max=50000` },
        { title: '关键词 + 最新在前', body: `${origin}/cards?q=皮卡丘&sort=newest` },
      ],
    },
    {
      id: 'images',
      title: '图片尺寸建议',
      steps: [
        {
          title: '首页 banner 图',
          body: '建议 1920 × 900（约 2.13:1）。系统会自动裁出 banner 尺寸的缩略图，横图不要小于这个比例太多，否则主体容易被裁掉。',
        },
        {
          title: '卡牌图片',
          body: '卡片在列表和详情页按 3:4 竖图展示，建议 800 × 800 起步（正方形也能用，会按中心裁成 3:4），单张不建议超过 2MB。',
        },
        {
          title: '门店照片',
          body: '门店首图用于大图展示，建议横向 16:9，宽度 1200 以上。',
        },
        {
          title: '替代文本（alt）必填',
          body: '每张图都要填 alt。它会被搜索引擎读取，也供读屏软件朗读。写一句看得懂的话，例如「皮卡丘 25 周年纪念卡正面」。',
        },
      ],
    },
    {
      id: 'bulk',
      title: '批量上架',
      intro:
        '一次上传多张卡图、逐张填卡牌信息的快捷页面。入口在左侧「商品 → 批量上架」，账号需要同时拥有「卡牌」和「图片」的新增权限。',
      steps: [
        {
          title: '上传图片',
          body: '点「添加文件」或把图片拖进左侧区域，系统会自动直传并显示进度。替代文本默认取文件名，可在右侧修改。',
        },
        {
          title: '批量填分类',
          body: '展开「批量填充分类」，一次选好 IP、系列、子系列、稀有度和发布状态，再点「应用到未保存的图片」。它只影响还没保存的图片，不会改动已保存的卡牌。',
        },
        {
          title: '逐张保存',
          body: '点左侧图片填写卡牌名称等必填项。保存成功后会自动跳到下一张待填图片；已保存的卡牌再改字段，按钮会变成「更新卡牌」。',
        },
        {
          title: '快捷操作',
          body: '⌘/Ctrl + Enter 保存当前卡牌，Alt + ←/→ 切换图片。有未保存内容时关闭或刷新页面会先提示。',
        },
        {
          title: '编号重复',
          body: '同一 IP / 系列 / 子系列下编号不能重复。报错会显示在「收藏编号」下方，改号后再存即可。',
        },
      ],
    },
    {
      id: 'status',
      title: '状态与发布',
      steps: [
        {
          title: '草稿不会出现在前台',
          body: '新内容默认是「草稿」，前台看不到。确认无误后把状态改成「已发布」，几秒后前台就会更新。归档用于下架但保留记录。',
        },
        {
          title: '公告可以定时',
          body: '公告的「发布时间」填未来时间就是定时发布。到点自动上线，不用守着。留空则立即展示。',
        },
      ],
    },
    {
      id: 'code',
      title: '卡牌编号必须唯一',
      body: '同一个 IP、系列、子系列下，卡牌编号不能重复。重复保存会报错，提示「同一 IP / 系列 / 子系列 下的编号已存在」。改一下编号再存即可。',
    },
    {
      id: 'sort',
      title: '排序（sort）',
      body: 'banner、门店、IP、系列等都有排序字段。数字越小越靠前。留空或填 0 时按默认顺序（通常是最新在前）。',
    },
    {
      id: 'delete',
      title: '删除不可恢复',
      body: '删除是硬删除。卡牌、公告删掉后前台立即 404，后台也无法找回。确定不要再删，拿不准就先改成「归档」。',
    },
    {
      id: 'locale',
      title: '语言只有一份内容',
      body: '后台里的标题、正文、描述都只有一份。前台按用户所在语言（/ja、/en）自动切换界面文案，内容本身不需要翻译三份。',
    },
  ]

  return { examples, sections }
}

export async function HelpView({
  initPageResult,
  params,
  searchParams,
  user,
}: AdminViewServerProps) {
  const origin = await getOrigin()
  const { examples, sections } = buildSections(origin)

  // 根视图（Root View）默认是「裸」渲染：Payload 的 Root 路由只在
  // templateType === 'default' 时才套 DefaultTemplate（含侧栏 Nav + 顶栏 Header），
  // 而按路由匹配的自定义根视图不会自动设置 templateType。所以必须显式用
  // DefaultTemplate 包裹，才能复用管理端通用布局（左侧菜单、顶栏都在）。
  // 数据取自 AdminViewServerProps：req/payload/permissions/visibleEntities 走
  // initPageResult，params/searchParams/user 直接取。
  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      req={initPageResult.req}
      searchParams={searchParams}
      user={user}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter className="admin-help">
      <header className="admin-help__header">
        <h1 className="admin-help__title">后台操作帮助</h1>
        <p className="admin-help__lead">
          这份说明覆盖日常最容易出错的几处。有拿不准的地方，先看「怎样添加跳转链接」和「图片尺寸建议」两节。
        </p>
      </header>

      <nav className="admin-help__toc" aria-label="目录">
        {sections.map((s, i) => (
          <a className="admin-help__toc-link" href={`#help-${s.id}`} key={s.id}>
            {i + 1}. {s.title}
          </a>
        ))}
      </nav>

      {sections.map((section, index) => (
        <section className="admin-help__section" id={`help-${section.id}`} key={section.id}>
          <h2 className="admin-help__section-title">
            <span className="admin-help__num">{index + 1}</span>
            {section.title}
          </h2>
          {section.intro ? <p className="admin-help__text">{section.intro}</p> : null}

          {section.body ? <p className="admin-help__text">{section.body}</p> : null}

          {section.id === 'links' ? (
            <p className="admin-help__cta">
              <MousePointerClick className="admin-help__inline-icon" />
              去列表页点「链接」列的小胶囊即可复制。
            </p>
          ) : null}

          {section.id === 'patterns' ? (
            <div className="admin-help__table-wrap">
              <table className="admin-help__table">
                <thead>
                  <tr>
                    <th>页面</th>
                    <th>示例链接</th>
                  </tr>
                </thead>
                <tbody>
                  {examples.map((e) => (
                    <tr key={e.example}>
                      <td>{e.label}</td>
                      <td>
                        <code className="admin-help__code">{e.example}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {section.steps ? (
            <ol className="admin-help__steps">
              {section.steps.map((step) => (
                <li className="admin-help__step" key={step.title}>
                  <span className="admin-help__step-title">{step.title}</span>
                  <span className="admin-help__step-body">{step.body}</span>
                </li>
              ))}
            </ol>
          ) : null}

          {section.title === '图片尺寸建议' ? (
            <p className="admin-help__hint">
              <ImageIcon className="admin-help__inline-icon" />
              图片在「素材」集合里上传，再回到内容里选图。
            </p>
          ) : null}

          {section.id === 'links' ? (
            <p className="admin-help__hint">
              <Link2 className="admin-help__inline-icon" />
              想确认链接对不对，先把拼好的路径在浏览器里打开试一遍，再填进 banner。
            </p>
          ) : null}
        </section>
      ))}

      <footer className="admin-help__footer">
        <Link href="/admin" className="admin-help__back">
          返回工作台
        </Link>
      </footer>
      </Gutter>
    </DefaultTemplate>
  )
}

export default HelpView
