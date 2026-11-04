'use client'

import { useAuth, usePayloadAPI } from '@payloadcms/ui'
import { useState, type ReactNode } from 'react'

type MediaDoc = {
  id: string
  url?: string
  sizes?: {
    thumb?: { url?: string }
  }
}

/** 没有头像 / 头像加载失败时的兜底：取姓名或邮箱首字母，画在品牌红圆里。 */
function InitialsFallback({ user }: { user: Record<string, unknown> | null | undefined }) {
  const raw =
    (typeof user?.name === 'string' && user.name) ||
    (typeof user?.email === 'string' && user.email) ||
    ''
  const initials = raw.trim().charAt(0).toUpperCase() || 'U'
  return (
    <span className="admin-account-avatar__initials" aria-hidden="true">
      {initials}
    </span>
  )
}

/** 有上传头像时：拉取 media 文档拿到 url，渲染成圆形缩略图；任何一步失败都退回兜底。 */
function AvatarImage({ avatarId, fallback }: { avatarId: string; fallback: ReactNode }) {
  const [{ data, isLoading, isError }] = usePayloadAPI(`/api/media/${avatarId}`)
  const [broken, setBroken] = useState(false)

  if (isLoading || isError || !data || broken) return <>{fallback}</>
  // 本地存储返回相对路径（/api/media/file/...），S3 返回绝对 https，浏览器都能直接解析。
  const url = (data as MediaDoc).sizes?.thumb?.url ?? (data as MediaDoc).url
  if (!url) return <>{fallback}</>
  return (
    <img
      src={url}
      alt=""
      className="admin-account-avatar__img"
      draggable={false}
      onError={() => setBroken(true)}
    />
  )
}

/**
 * 后台右上角账户头像。
 *
 * 之前用 Payload 默认的 `admin.avatar: 'gravatar'`：完全依赖 gravatar.com 按邮箱取图，
 * 在内网 / 离线 / 墙环境下经常加载失败，且默认实现没有兜底，于是右上角出现裂图。
 *
 * 现在改走「用户自己上传」：Users 集合加了 `avatar`（upload → media）字段，账户页
 * 即可上传；这里优先显示那张图，失败或没传时退回首字母圆，绝不裂图。
 */
export function AdminAccountAvatar() {
  const { user } = useAuth()

  const avatarId =
    typeof user?.avatar === 'object' && user?.avatar
      ? (user.avatar as { id?: string }).id
      : (user?.avatar as string | undefined)

  const fallback = <InitialsFallback user={user as Record<string, unknown> | null} />

  if (!avatarId) return fallback
  return <AvatarImage avatarId={String(avatarId)} fallback={fallback} />
}
