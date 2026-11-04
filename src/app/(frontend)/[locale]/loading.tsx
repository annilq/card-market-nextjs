// 页面切换时的「即时加载态」。
//
// 放在 `[locale]` 段层：一次后台渲染期间，只有这一段（页面内容区）被
// Suspense fallback 替换，根布局里的顶栏 / 页脚 / 无闪烁主题脚本照常保留、
// 保持可交互。于是切换页面时用户立刻看到骨架屏，而不是停在旧页或白屏——
// 这是「切换慢」体感改善最直接的手段（见对话里的优化项 ①）。
//
// 额外好处：Next 对 dynamic 路由，只要有 loading.js 边界，`<Link prefetch="auto">`
// 就会把「到最近 loading 边界为止的局部路由」预取下来（见优化项 ②），两者互补。
//
// 纯服务端组件即可，不需要客户端水合；用已有的设计令牌（surface / border / pulse）
// 与正式页面观感一致。
export default function LocaleLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="加载中"
      className="animate-pulse"
    >
      {/* 列表/网格占位：模拟若干卡片方块 + 文字行 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg bg-surface">
            <div className="aspect-[3/4] bg-surface-2" />
            <div className="space-y-2 p-2.5">
              <div className="h-3 w-5/6 rounded bg-surface-2" />
              <div className="h-2.5 w-2/3 rounded bg-surface-2" />
              <div className="mt-2 h-4 w-1/3 rounded bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
