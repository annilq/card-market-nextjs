import {
  FileText,
  Gem,
  HelpCircle,
  Image as ImageIcon,
  LayoutDashboard,
  Inbox,
  KeyRound,
  Layers,
  ListTree,
  Megaphone,
  Package,
  RectangleHorizontal,
  Settings,
  ShieldCheck,
  Store,
  Tags,
  Upload,
  Users,
} from 'lucide-react'

import type { AdminMessageKey } from '@/lib/admin/i18n'

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
  help: HelpCircle,
  banners: RectangleHorizontal,
  cards: Package,
  'bulk-cards': Upload,
  'card-statuses': ShieldCheck,
  'info-pages': FileText,
  ips: Tags,
  media: ImageIcon,
  messages: Inbox,
  'no-deduction-buyback': Tags,
  rarities: Gem,
  series: Layers,
  'site-settings': Settings,
  shops: Store,
  'sub-series': ListTree,
  users: Users,
  roles: KeyRound,
} as const

export const ENTITY_DESCRIPTION_KEYS: Record<string, AdminMessageKey> = {
  announcements: 'entity.announcements',
  banners: 'entity.banners',
  cards: 'entity.cards',
  'bulk-cards': 'entity.bulkCards',
  'card-statuses': 'entity.cardStatuses',
  'info-pages': 'entity.infoPages',
  ips: 'entity.ips',
  media: 'entity.media',
  messages: 'entity.messages',
  'no-deduction-buyback': 'entity.noDeduction',
  rarities: 'entity.rarities',
  roles: 'entity.roles',
  series: 'entity.series',
  'site-settings': 'entity.siteSettings',
  shops: 'entity.shops',
  'sub-series': 'entity.subSeries',
  users: 'entity.users',
}

/** 找不到映射时的兜底图标。 */
export const ENTITY_FALLBACK_ICON = Layers
