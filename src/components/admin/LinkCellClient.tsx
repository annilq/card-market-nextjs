'use client'

import { toast } from '@payloadcms/ui'
import { Check, Copy, Link2 } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'

/**
 * 列表里的「链接」单元格（客户端部分）。
 *
 * 交互：默认显示一枚 `链接` 小胶囊，鼠标悬停给出提示「点击展开当前条目的前台链接」。
 * 点击后展开完整路径与一颗复制按钮，复制走 Clipboard API 并给一条 toast。
 * 展开状态三秒后自动收起，避免整列常开把行高撑乱。
 *
 * 为什么路径在服务端算好再传进来：拼链接的规则只该有一份（见
 * src/lib/admin/public-links.ts）。这里只负责展示与复制，不重复推导。
 */
export function LinkCellClient({ path }: { path: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // 展开后 4 秒自动收起；再次点击可立即切换。
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => setOpen(false), 4000)
    return () => window.clearTimeout(timer)
  }, [open])

  const copy = useCallback(async () => {
    try {
      // 复制相对路径，不复制域名：运营要粘到 banner 字段里的是 `/cards/12`，
      // 前台会自己补语言段；带上线上域名反而在本地或预览环境点不开。
      await navigator.clipboard.writeText(path)
      setCopied(true)
      toast.success(`已复制 ${path}`)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('复制失败，请手动选中路径复制')
    }
  }, [path])

  if (!open) {
    return (
      <button
        className="admin-linkcell__badge"
        onClick={() => setOpen(true)}
        title={`点击展开当前条目的前台链接（${path}）`}
        type="button"
      >
        <Link2 className="admin-linkcell__icon" />
        链接
      </button>
    )
  }

  return (
    <span className="admin-linkcell__open">
      <button
        className="admin-linkcell__path"
        onClick={() => void copy()}
        title="点击复制"
        type="button"
      >
        {path}
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
    </span>
  )
}
