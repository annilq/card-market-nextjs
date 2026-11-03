import { withPayload } from '@payloadcms/next/withPayload'
import { withSentryConfig } from '@sentry/nextjs/config'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone 输出：Docker 镜像只拷 .next/standalone 即可运行（见 Dockerfile）
  output: 'standalone',
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
}

// Sentry 错误上报：DSN / org / project 来自 .env。
// 未配置时 Sentry 自动降级为「不发送」，不影响构建与运行。
export default withSentryConfig(withPayload(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // 构建时上传 source map 需要 SENTRY_AUTH_TOKEN；没有就跳过，不报错
  silent: true,
  widenClientFileUpload: true,
})
