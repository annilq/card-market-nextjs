import { withPayload } from '@payloadcms/next/withPayload'
import { withSentryConfig } from '@sentry/nextjs/config'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone 输出：Docker 镜像只拷 .next/standalone 即可运行（见 Dockerfile）
  output: 'standalone',
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  // 关闭 Next 自动的「末尾斜杠」重定向。
  // 后台根路由是 Payload 的可选 catch-all `admin/[[...segments]]`，默认配置下访问
  // 裸 `/admin` 会被 308/307 重定向到 `/admin/`（线上 Lighthouse 实测浪费 ~1.17s，
  // 性能分从 /admin/ 的 89 掉到 /admin 的 76）。开启后 `/admin` 与 `/admin/` 都直接
  // 返回 200，不再跳转。前台 canonical / OG 本就统一走「无斜杠」绝对地址（见
  // src/lib/site-url.ts 的 absUrl），不会因此产生重复 URL 的 SEO 问题。
  skipTrailingSlashRedirect: true,
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
