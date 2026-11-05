// 后台「公开链接」登记表：哪一条记录对应前台的哪个地址。
//
// 运营需要知道「这张卡 / 这条公告 / 这个信息页」在前台的链接，才能把它填进
// banner 的跳转链接，或者直接发给别人。链接怎么拼只该有这一份实现：后台列表的
// 链接列、帮助页的示例，都从这里取，改一处两边一起变。
//
// 返回值是**不带语言前缀**的路径（如 `/cards/12`）。前台会用 localizeHref 自动
// 补上 /ja、/en，所以这里不拼语言段，否则 banner 在日语站会跳到中文页。

/** 有公开前台页面的集合。其它集合（media、users、维度表）没有可复制的链接。 */
export type LinkableCollection =
  | 'announcements'
  | 'banners'
  | 'cards'
  | 'info-pages'
  | 'shops'
  | 'messages'

/** 带 id 的最小文档形状：列表单元格拿到的 rowData 就长这样。 */
type RowDoc = { id?: number | string | null } & Record<string, unknown>

/** 链接缺参数时返回 null，而不是拼出一个必然 404 的地址。 */
function withId(prefix: string, doc: RowDoc): string | null {
  const id = doc.id
  if (id == null || id === '') return null
  return `${prefix}/${id}`
}

/**
 * 集合 → 路径拼接器。集合没有前台页面时返回 null。
 *
 * - cards / announcements：详情页是 `/前缀/<数字 id>`。
 * - info-pages：`/info/<pageKey>`，pageKey 是固定四个之一。
 * - banners：首页轮播，点进去落在首页 `/`。
 * - messages：留言页没有单条详情，只有 `/message`（可带 `?card=<id>` 指上下文）。
 */
export function publicPathFor(slug: string, doc: RowDoc): string | null {
  switch (slug as LinkableCollection) {
    case 'cards':
      return withId('/cards', doc)
    case 'announcements':
      return withId('/announcements', doc)
    case 'shops':
      // 门店没有单店详情页，统一落到门店列表。
      return '/shops'
    case 'banners':
      return '/'
    case 'info-pages': {
      const key = doc.pageKey
      return typeof key === 'string' && key ? `/info/${key}` : null
    }
    case 'messages': {
      // 留言工单没有公开详情页；给访客侧的留言页，并在可能时带上卡牌上下文。
      const card = doc.card
      const cardId =
        typeof card === 'object' && card && 'id' in card
          ? (card as { id?: unknown }).id
          : card
      return typeof cardId === 'number' || typeof cardId === 'string'
        ? `/message?card=${cardId}`
        : '/message'
    }
    default:
      return null
  }
}

/**
 * 「链接」列要展示的地址。
 *
 * 对大多数集合，展示的是**这条记录自己的前台地址**（publicPathFor）。
 * 但 banner 不一样：banner 本身就是首页的一张轮播，它有自己的 `link` 字段
 * （点了跳到哪）。运营在 banner 列表里要看的是每条 banner 配的跳转目标，
 * 不是「它所在的页面」（那永远是首页 `/`）。所以这里对 banner 特判：
 *
 * - link 有值 → 原样返回（站内路径或外链都可能是运营填的）。
 * - link 为空 → href 为 null，label 给一句「未设置」，避免显示空单元格让人以为漏看。
 *
 * 其它集合沿用 publicPathFor；拼不出来时 href 与 label 都是 null（不渲染）。
 */
export function linkCellModel(
  slug: string,
  doc: RowDoc,
): { href: string | null; label: string | null; isBannerLink: boolean } {
  if (slug === 'banners') {
    const link = doc.link
    const value = typeof link === 'string' ? link.trim() : ''
    return value
      ? { href: value, label: value, isBannerLink: true }
      : { href: null, label: '未设置跳转', isBannerLink: true }
  }
  const path = publicPathFor(slug, doc)
  return { href: path, label: path, isBannerLink: false }
}

/**
 * 帮助页要展示的「有哪些链接可填」清单。顺序刻意按运营最常填的顺序排。
 * 从同一张登记表衍生的说明文本，避免帮助页写死后与代码不一致。
 */
export function explainLinkPatterns(origin: string): { example: string; label: string }[] {
  return [
    { label: '首页', example: `${origin}/` },
    { label: '卡牌列表（可带筛选，见下方）', example: `${origin}/cards` },
    { label: '某张卡详情', example: `${origin}/cards/123` },
    { label: '公告列表', example: `${origin}/announcements` },
    { label: '某条公告', example: `${origin}/announcements/45` },
    { label: '店铺列表', example: `${origin}/shops` },
    { label: '留言页', example: `${origin}/message` },
    { label: '信息页（四个固定标识）', example: `${origin}/info/terms` },
  ]
}
