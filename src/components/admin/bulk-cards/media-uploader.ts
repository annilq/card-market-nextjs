import type { MediaRef } from './batch-state'

export type MediaUploadPhase = 'requesting' | 'uploading' | 'processing'

export type MediaUploadOptions = {
  alt: string
  apiRoute: string
  signal: AbortSignal
  onPhase?: (phase: MediaUploadPhase) => void
  onProgress?: (sent: number, total: number) => void
}

export type MediaUploadFailurePhase = 'request' | 'upload' | 'create'

export class MediaUploadError extends Error {
  readonly phase: MediaUploadFailurePhase

  constructor(phase: MediaUploadFailurePhase, message: string) {
    super(message)
    this.name = 'MediaUploadError'
    this.phase = phase
  }
}

type SignedUpload = {
  clientUploadContext: { prefix: string; signedReceipt: string }
  filename: string
  headers: Record<string, string> | null
  url: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError')
}

/**
 * 本地开发下 Payload 返回的素材地址可能指向生产域名。绝对 URL 会让浏览器
 * 离开当前源并丢掉后台会话，所以 `/api/...` 只保留路径，其余地址原样返回。
 */
function displayUrl(url: string | null | undefined): string {
  if (!url) return ''
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.pathname.startsWith('/api/') ? `${parsed.pathname}${parsed.search}` : url
  } catch {
    return url
  }
}

function parseSignedUpload(value: unknown): SignedUpload {
  const invalid = () => new MediaUploadError('request', '上传地址响应格式不正确')
  if (!isRecord(value)) throw invalid()
  const context = value.clientUploadContext
  const { filename, url } = value
  if (
    !isRecord(context) ||
    typeof context.prefix !== 'string' ||
    typeof context.signedReceipt !== 'string' ||
    typeof filename !== 'string' ||
    typeof url !== 'string'
  ) {
    throw invalid()
  }

  const headers = isRecord(value.headers)
    ? Object.fromEntries(
        Object.entries(value.headers).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : null

  return {
    clientUploadContext: {
      prefix: context.prefix,
      signedReceipt: context.signedReceipt,
    },
    filename,
    headers,
    url,
  }
}

function parseMediaRef(value: unknown, fallbackAlt: string, fallbackFilename: string): MediaRef {
  if (!isRecord(value) || typeof value.id !== 'number') {
    throw new MediaUploadError('create', '素材创建响应格式不正确')
  }

  const url = typeof value.url === 'string' ? value.url : ''
  const thumbUrl =
    isRecord(value.sizes) &&
    isRecord(value.sizes.thumb) &&
    typeof value.sizes.thumb.url === 'string'
      ? value.sizes.thumb.url
      : null

  return {
    id: value.id,
    alt: typeof value.alt === 'string' ? value.alt : fallbackAlt,
    filename: typeof value.filename === 'string' ? value.filename : fallbackFilename,
    url: displayUrl(url),
    thumbUrl: displayUrl(thumbUrl ?? url),
    width: typeof value.width === 'number' ? value.width : 0,
    height: typeof value.height === 'number' ? value.height : 0,
  }
}

async function readJson(response: Response, phase: MediaUploadFailurePhase): Promise<unknown> {
  try {
    return await response.json()
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new MediaUploadError(phase, '响应格式不正确')
  }
}

async function requestSignedUpload(
  file: File,
  apiRoute: string,
  signal: AbortSignal,
): Promise<SignedUpload> {
  let response: Response
  try {
    response = await fetch(`${apiRoute}/storage-s3-generate-signed-url`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collectionSlug: 'media',
        filename: file.name,
        filesize: file.size,
        mimeType: file.type,
      }),
      signal,
    })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new MediaUploadError('request', '获取上传地址失败，请检查网络')
  }

  if (!response.ok) {
    const message =
      response.status === 404
        ? '当前环境未启用对象存储直传，请联系管理员配置 S3'
        : response.status === 401 || response.status === 403
          ? '没有上传权限或登录状态已失效，请重新登录'
          : `获取上传地址失败（HTTP ${response.status}）`
    throw new MediaUploadError('request', message)
  }

  return parseSignedUpload(await readJson(response, 'request'))
}

function putFile(args: {
  url: string
  file: File
  headers: Record<string, string> | null
  signal: AbortSignal
  onProgress?: (sent: number, total: number) => void
}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (args.signal.aborted) {
      reject(abortError())
      return
    }

    const xhr = new XMLHttpRequest()
    xhr.open('PUT', args.url)
    xhr.withCredentials = false

    const contentType = args.headers?.['Content-Type'] ?? args.headers?.['content-type']
    if (contentType) xhr.setRequestHeader('Content-Type', contentType)

    const abort = () => xhr.abort()
    const cleanup = () => args.signal.removeEventListener('abort', abort)

    xhr.upload.onprogress = (event) => {
      args.onProgress?.(event.loaded, event.total > 0 ? event.total : args.file.size)
    }
    xhr.onload = () => {
      cleanup()
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new MediaUploadError('upload', `图片上传失败（HTTP ${xhr.status}）`))
    }
    xhr.onerror = () => {
      cleanup()
      reject(
        new MediaUploadError('upload', '图片上传失败，请检查网络或对象存储的 CORS 配置'),
      )
    }
    xhr.onabort = () => {
      cleanup()
      reject(abortError())
    }

    args.signal.addEventListener('abort', abort, { once: true })
    xhr.send(args.file)
  })
}

async function createMedia(
  file: File,
  alt: string,
  apiRoute: string,
  signed: SignedUpload,
  signal: AbortSignal,
): Promise<MediaRef> {
  const form = new FormData()
  form.append('_payload', JSON.stringify({ alt }))
  form.append(
    'file',
    JSON.stringify({
      clientUploadContext: {
        prefix: signed.clientUploadContext.prefix,
        signedReceipt: signed.clientUploadContext.signedReceipt,
      },
      collectionSlug: 'media',
      filename: signed.filename,
      mimeType: file.type,
      size: file.size,
    }),
  )

  let response: Response
  try {
    response = await fetch(`${apiRoute}/media`, {
      method: 'POST',
      credentials: 'include',
      body: form,
      signal,
    })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new MediaUploadError('create', '创建素材失败，请检查网络')
  }

  if (!response.ok) {
    const message =
      response.status === 401 || response.status === 403
        ? '没有创建素材的权限或登录状态已失效，请重新登录'
        : `创建素材失败（HTTP ${response.status}）`
    throw new MediaUploadError('create', message)
  }

  const body = await readJson(response, 'create')
  const doc = isRecord(body) ? (body.doc ?? body) : body
  return parseMediaRef(doc, alt, file.name)
}

export async function uploadMedia(file: File, options: MediaUploadOptions): Promise<MediaRef> {
  const { alt, apiRoute, signal, onPhase, onProgress } = options

  onPhase?.('requesting')
  const signed = await requestSignedUpload(file, apiRoute, signal)
  if (signal.aborted) throw abortError()

  onPhase?.('uploading')
  await putFile({ url: signed.url, file, headers: signed.headers, signal, onProgress })
  if (signal.aborted) throw abortError()

  onPhase?.('processing')
  return createMedia(file, alt, apiRoute, signed, signal)
}
