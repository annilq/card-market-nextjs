import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.SENTRY_RELEASE ?? process.env.npm_package_version,
  // 性能采样：开发环境 100%（便于本地看 trace），生产按量采并强制采错误相关请求
  tracesSampler: (samplingContext) => {
    if (process.env.NODE_ENV === 'development') return 1.0
    if (samplingContext.parentSampled) return 1.0
    return 0.1
  },
  // 会话回放：采样 10% 的正常会话，出错会话 100% 采集（用户态应用建议开启）
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  // 结构化日志：console.warn / console.error 自动转发为 Sentry 日志，
  // 与 trace / error 关联（@sentry/nextjs 11.10 通过集成开启，无 enableLogs 开关）
  integrations: [
    // 浏览器端会话回放（仅 client 配置加载）
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    // 将 console.warn / console.error 自动转发为 Sentry 日志
    Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
  ],
  debug: false,
})

// App Router 路由切换也记为 navigation span，补全前端 tracing
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
