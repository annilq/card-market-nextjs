import { notFound } from 'next/navigation'

/**
 * 兜底 catch-all：`[locale]` 下所有未匹配的子路径（如 `/zh/foo`、`/ja/anything/deep`）
 * 都落到这里，再主动 notFound() 把我们定制的 `[locale]/not-found.tsx` 唤起——
 * 否则这些路径会越过 `[locale]` 段、撞到 frontend 组根，由于没有 app/layout.tsx，
 * Next 只能回退到内置 404（无页眉页脚、无品牌语言）。
 *
 * 注意：本项目的 `<html>` 外壳写在 `(frontend)/layout.tsx` 里，而不是
 * `app/layout.tsx`——这样做正是为了不与 Payload 后台的 RootLayout（也渲染 `<html>`）冲突。
 * 代价是「未匹配路由」没有真正的根 not-found 边界可用，于是用这一层 catch-all 把流量
 * 导回段内的定制 404。语言段非法时也一样：`/de/xxx` 的 `xxx` 无页面可匹配就落到
 * 这里，`/de/cards` 这种有页面的则由页面自己 notFound()，两条路都汇到同一个边界。
 */
export default function CatchAllNotFound() {
  notFound()
}
