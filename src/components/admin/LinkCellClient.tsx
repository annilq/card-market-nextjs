'use client'

import { toast } from '@payloadcms/ui'
import { Check, Copy, ExternalLink } from 'lucide-react'
import React, { useCallback, useState } from 'react'

/**
 * 列表里的「链接」单元格（客户端部分）。
 *
 * 直接常显路径 + 两颗按钮：复制、打开。路径是相对站内路径（如 /cards/12），
 * 拼链接的规则在服务端算好传进来（见 public-links.ts），这里不重复推导。
 *
 * 打开按钮：前台可见的记录直接开新标签；草稿 / 归档 / 定时未到点的记录前台
 * 实际看不到（点了会 404），所以先弹一条确认，用户坚持才跳。判定在服务端
 * 的 LinkCell 里算好（visible），这里只按结果决定要不要拦一下。
 */
export function LinkCellClient({ path, visible }: { path: string; visible: boolean }) {
  const [copied, setCopied] = useState(false)

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

  const open = useCallback(() => {
    if (!visible) {
      const ok = window.confirm('这条记录当前未发布，前台看不到（打开会 404）。仍要打开吗？')
      if (!ok) return
    }
    window.open(path, '_blank', 'noopener,noreferrer')
  }, [path, visible])

  return (
    <span className="admin-linkcell__open">
      <button
        className="admin-linkcell__path"
        onClick={() => void copy()}
        title={`复制 ${path}`}
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
      <button
        aria-label={visible ? '打开前台页面' : '打开前台页面（当前未发布）'}
        className={`admin-linkcell__copy${visible ? '' : ' admin-linkcell__copy--warn'}`}
        onClick={open}
        title={visible ? '打开前台页面' : '当前未发布，前台看不到'}
        type="button"
      >
        <ExternalLink className="admin-linkcell__icon" />
      </button>
    </span>
  )
}
