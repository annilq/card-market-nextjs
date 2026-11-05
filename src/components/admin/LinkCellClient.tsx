'use client'

import { toast } from '@payloadcms/ui'
import { Check, Copy, ExternalLink } from 'lucide-react'
import React, { useCallback, useState } from 'react'

/**
 * 列表里的「链接」单元格（客户端部分）。
 *
 * 常显地址 + 复制按钮，可打开时再加一颗打开按钮。
 *
 * 两种情况：
 * - href 有值：展示并复制它。visible=false（记录未发布，点开是 404）时，
 *   打开前先弹确认。banner 配的跳转 link 由服务端判定为 visible。
 * - href 为空（banner 没填跳转）：只显示 label「未设置跳转」，不给按钮。
 */
export function LinkCellClient({
  href,
  label,
  visible,
  onlyCopyable = false,
}: {
  href: string | null
  label: string
  visible: boolean
  onlyCopyable?: boolean
}) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    if (href == null) return
    try {
      // 复制原值，不补域名：运营要粘到字段里的是 `/cards/12` 这类相对路径，
      // 前台会自己补语言段；外链则原样是完整地址。
      await navigator.clipboard.writeText(href)
      setCopied(true)
      toast.success(`已复制 ${href}`)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('复制失败，请手动选中路径复制')
    }
  }, [href])

  const open = useCallback(() => {
    if (href == null) return
    if (!visible) {
      const ok = window.confirm('这条记录当前未发布，前台看不到（打开会 404）。仍要打开吗？')
      if (!ok) return
    }
    window.open(href, '_blank', 'noopener,noreferrer')
  }, [href, visible])

  if (onlyCopyable || href == null) {
    return <span className="admin-linkcell__empty">{label}</span>
  }

  return (
    <span className="admin-linkcell__open">
      <button
        className="admin-linkcell__path"
        onClick={() => void copy()}
        title={`复制 ${href}`}
        type="button"
      >
        {label}
      </button>
      <button
        aria-label={copied ? '已复制' : '复制链接'}
        className="admin-linkcell__copy"
        onClick={() => void copy()}
        title={copied ? '已复制' : '复制链接'}
        type="button"
      >
        {copied ? <Check className="admin-linkcell__icon" /> : <Copy className="admin-linkcell__icon" />}
      </button>
      <button
        aria-label={visible ? '打开链接' : '打开链接（当前未发布）'}
        className={`admin-linkcell__copy${visible ? '' : ' admin-linkcell__copy--warn'}`}
        onClick={open}
        title={visible ? '打开链接' : '当前未发布，前台看不到'}
        type="button"
      >
        <ExternalLink className="admin-linkcell__icon" />
      </button>
    </span>
  )
}
