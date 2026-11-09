/**
 * Backblaze B2 的 S3 兼容 API 不实现「条件写」（If-None-Match）。
 *
 * `@payloadcms/storage-s3` 从 3.90.0 起为修 CVE-2026-105867（clientUploads 可能覆盖
 * 已有对象），在 `generateSignedURL` 里把 `IfNoneMatch: '*'` 硬编码进预签名的
 * PutObject 命令，并把 `'If-None-Match': '*'` 作为浏览器请求头返回。B2 收到后会回
 * `501 NotImplemented: A header you provided implies functionality that is not
 * implemented If-None-Match`——这不是 CORS、不是密钥、也不是 AWS SDK 的 checksum
 * 参数（已用真实 B2 探针逐一排除）。3.93.0 仍硬编码，且插件没有兼容开关。
 *
 * 这里不重写上游那 80 行逻辑：先让上游 handler 照常跑完鉴权、去重、
 * `randomUUID()` 唯一 Key 与签名回执，再从它签好的 URL 里取出**同一个对象 Key**，
 * 重签一张不带 `IfNoneMatch` 的 PUT URL 并换掉浏览器头里的 `If-None-Match`。
 * 对象位置、`clientUploadContext` / 回执、文档引用全部不变，只换签名。
 *
 * 安全取舍要如实说：去掉条件写等于少了一层「服务端强制不覆盖」的纵深防御。
 * 本项目仍保留上游的防覆盖主体——`resolveSignedURLKey` 每次上传生成
 * `randomUUID()` 段作为 Key，`createClientUploadReceipt` 把 collection / filename /
 * 用户 / 6 小时过期签进回执，客户端无法指定 Key；`assertClientUploadAccess` 的
 * create/update 权限校验也照常执行。B2 既然不支持条件写，只能靠唯一 Key 兜底。
 * 将来换回真正的 S3、或 B2 支持条件写时，应移除本 shim（见下方自动失效判断）。
 */
import {
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
  type S3ClientConfig,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Config, Endpoint, Plugin } from 'payload'

const SIGNED_URL_ENDPOINT = '/storage-s3-generate-signed-url'
const EXPIRES_IN_SECONDS = 600

type Options = {
  bucket: string
  /** 与 s3Storage({ config }) 传的同一份配置，保证 endpoint / region / credentials 一致。 */
  config: S3ClientConfig
}

type SignedURLBody = {
  clientUploadContext: unknown
  docPrefix: string
  filename: string
  headers: Record<string, string>
  url: string
}

export function b2ClientUploadsPlugin({ bucket, config }: Options): Plugin {
  // 重签客户端与 s3Storage 内部缓存的那份不是同一个实例，但 SigV4 签名只由
  // endpoint / region / credentials / 命令决定，实例无关（已对真实 B2 PUT 验证）。
  const client = new S3Client(config)

  const plugin: Plugin = (incomingConfig: Config): Config => {
    const endpoint = incomingConfig.endpoints?.find(
      (candidate) =>
        candidate.method === 'post' &&
        candidate.path.startsWith(SIGNED_URL_ENDPOINT),
    )

    // clientUploads 没开、或上游换了端点路径：不接管，保持原样。
    if (!endpoint) return incomingConfig

    const upstreamHandler = endpoint.handler

    const handler: Endpoint['handler'] = async (req) => {
      const response = await upstreamHandler(req)
      if (!response.ok) return response

      // clone 一份读 JSON，形状不符时还能把原始 Response 原样交回去。
      let body: SignedURLBody
      try {
        body = (await response.clone().json()) as SignedURLBody
      } catch {
        return response
      }
      if (typeof body?.url !== 'string' || !body.headers) return response

      const original = new URL(body.url)
      const signedHeaders = (
        original.searchParams.get('X-Amz-SignedHeaders') ?? ''
      )
        .split(';')
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean)

      // 上游哪天去掉条件写（或 B2 开始支持）就自动失效，不需要记得回来删代码。
      const hasConditionalWrite =
        signedHeaders.includes('if-none-match') ||
        Object.keys(body.headers).some(
          (name) => name.toLowerCase() === 'if-none-match',
        )
      if (!hasConditionalWrite) return response

      // 同一个对象 Key：virtual-hosted style 下 pathname 即 /<key>；
      // 万一将来开了 forcePathStyle，还要剥掉开头的 /<bucket>。
      let key = decodeURIComponent(original.pathname.replace(/^\//, ''))
      if (key.startsWith(`${bucket}/`)) key = key.slice(bucket.length + 1)

      const signableHeaders = new Set(
        signedHeaders.filter(
          (name) => name !== 'host' && name !== 'if-none-match',
        ),
      )

      const headers = { ...body.headers }
      for (const name of Object.keys(headers)) {
        if (name.toLowerCase() === 'if-none-match') delete headers[name]
      }

      // 只重签上游确实签过的头：没签 content-type / content-length 就不要把它们
      // 塞进命令，否则浏览器实际发出的头与签名头集会不一致。
      // ACL 是 hoist 到 query 的 x-amz-acl，从原 URL 读回，避免调用方重复传参。
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({
          ACL:
            (original.searchParams.get('x-amz-acl') as PutObjectCommandInput['ACL']) ??
            undefined,
          Bucket: bucket,
          ContentLength:
            signableHeaders.has('content-length') && headers['Content-Length']
              ? Number(headers['Content-Length'])
              : undefined,
          ContentType: signableHeaders.has('content-type')
            ? headers['Content-Type']
            : undefined,
          Key: key,
        }),
        { expiresIn: EXPIRES_IN_SECONDS, signableHeaders },
      )

      // clientUploadContext / docPrefix / filename / signedReceipt 原样带回：
      // 文档创建时 Payload 要凭回执把这次直传与文档记录对上。
      return Response.json({ ...body, headers, url })
    }

    return {
      ...incomingConfig,
      endpoints: incomingConfig.endpoints?.map((candidate) =>
        candidate === endpoint ? { ...candidate, handler } : candidate,
      ),
    }
  }

  // buildConfig 按 order 升序串行执行插件；s3Storage 默认 0，必须排在它之后
  // 才能在 config.endpoints 里看到刚注册的签发端点。
  plugin.order = 1
  return plugin
}
