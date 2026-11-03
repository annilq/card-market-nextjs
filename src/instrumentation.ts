/**
 * Next.js 注入点：只在服务端运行时加载对应的 Sentry 配置。
 * 客户端配置由 @sentry/nextjs 的构建插件自动注入，这里不用管。
 * 注意：项目用了 `src/` 目录，所以本文件放在 `src/`，而 sentry.*.config.ts 在根目录。
 */
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

// 让 RSC / Route Handler 抛出的错误也能精准上报（Next 15+ 的 onRequestError 钩子）
export const onRequestError = Sentry.captureRequestError
