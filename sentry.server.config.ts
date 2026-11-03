import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.SENTRY_RELEASE ?? process.env.npm_package_version,
  // 性能采样：开发环境 100%，生产按量采并强制采错误相关请求
  tracesSampler: (samplingContext) => {
    if (process.env.NODE_ENV === 'development') return 1.0
    if (samplingContext.parentSampled) return 1.0
    return 0.1
  },
  // 服务端错误栈带上局部变量值，便于在生产定位问题
  includeLocalVariables: true,
  // Payload 请求里可能含敏感字段，按需脱敏：
  // beforeSend(event) {
  //   event.request?.cookies && (event.request.cookies = {})
  //   return event
  // },
})
