/**
 * 后台图形标识：一枚「卡堆」方形标记 + 字标。
 *
 * 之前这里是孟菲斯的圆 / 三角 / 波浪线：四个高饱和色块贴在导航与登录页上，
 * 在要长时间盯着看的后台里，装饰色会和内容抢注意力。现在换成
 * 一枚只有一个语义的标记——一叠卡牌，配站点识别色（品牌红），
 * 缩到 24px 仍然读得出来，也不再与表单里的状态色混淆。
 *
 * 颜色全部走 CSS 变量（--brand-mark-*），深浅两套主题各给一档，
 * 深色下自动提亮，避免红底在近黑背景上发闷。
 */
const GRADIENT_ID = 'admin-brand-mark'

/** 标记本体：圆角方底 + 一叠卡牌。viewBox 固定 32，由调用方决定实际尺寸。 */
function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="admin-brand-mark"
      height={size}
      viewBox="0 0 32 32"
      width={size}
    >
      <defs>
        {/* stop-color 只能通过 CSS 生效：SVG 的 presentation attribute 里
            `var()` 浏览器不解析，所以这里走 inline style。 */}
        <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: 'var(--brand-mark-from)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--brand-mark-to)' }} />
        </linearGradient>
      </defs>
      <rect fill={`url(#${GRADIENT_ID})`} height="30" rx="8" width="30" x="1" y="1" />
      <rect
        fill="#fff"
        fillOpacity="0.5"
        height="11"
        rx="2"
        transform="rotate(-10 15 12.5)"
        width="13"
        x="8.5"
        y="7"
      />
      <rect fill="#fff" height="11.5" rx="2" width="10.5" x="12" y="13.5" />
      <rect
        fillOpacity="0.32"
        height="1.2"
        rx="0.6"
        style={{ fill: 'var(--brand-mark-ink)' }}
        width="6.5"
        x="14"
        y="17"
      />
      <rect
        fillOpacity="0.18"
        height="1.2"
        rx="0.6"
        style={{ fill: 'var(--brand-mark-ink)' }}
        width="4"
        x="14"
        y="20"
      />
    </svg>
  )
}

/** 导航里的方形小图标。 */
export function AdminIcon() {
  return <BrandMark size={32} />
}

/** 登录页的大 Logo：标记 + 字标。 */
export function AdminLogo() {
  return (
    <span className="admin-brand">
      <BrandMark size={36} />
      <span className="admin-brand__wordmark">card-market</span>
    </span>
  )
}
