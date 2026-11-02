import {
  FileText,
  Gem,
  Image as ImageIcon,
  LayoutDashboard,
  Inbox,
  Layers,
  ListTree,
  Megaphone,
  Package,
  RectangleHorizontal,
  Settings,
  Store,
  Tags,
  Users,
} from 'lucide-react'

/**
 * 集合 / 全局对应的图标与一句话说明。
 *
 * 图标是 lucide 的 1.75px 描边族，全站只有这一套——后台侧栏与仪表盘的
 * 集合索引共用同一张表，两处才不会给同一个集合配两个图标。
 * 说明那句话只出现在仪表盘：侧栏 248px 宽，放不下也不会去读。
 */
export const ENTITY_ICONS = {
  announcements: Megaphone,
  dashboard: LayoutDashboard,
  banners: RectangleHorizontal,
  cards: Package,
  'info-pages': FileText,
  ips: Tags,
  media: ImageIcon,
  messages: Inbox,
  rarities: Gem,
  series: Layers,
  'site-settings': Settings,
  shops: Store,
  'sub-series': ListTree,
  users: Users,
} as const

export const ENTITY_DESCRIPTIONS: Record<string, string> = {
  announcements: '公告：置顶、定时发布',
  banners: '首页轮播图与跳转链接',
  cards: '商品主体：名称、编号、价格、图片、描述',
  'info-pages': '审核用静态信息页',
  ips: '卡牌所属 IP / 大分类',
  media: '图片素材（卡牌图、banner、门店照片）',
  messages: '访客留言工单：新 / 已处理 / 已归档 / 垃圾',
  rarities: '稀有度及其展示顺序',
  series: 'IP 下的系列',
  'site-settings': '站点名称、联系方式与全局文案',
  shops: '门店：地址、营业时间、地图坐标',
  'sub-series': '系列下的子系列',
  users: '后台账号与角色',
}

/** 找不到映射时的兜底图标。 */
export const ENTITY_FALLBACK_ICON = Layers
