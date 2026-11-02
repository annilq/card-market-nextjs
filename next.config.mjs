import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone 输出：Docker 镜像只拷 .next/standalone 即可运行（见 Dockerfile）
  output: 'standalone',
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
}

export default withPayload(nextConfig)
