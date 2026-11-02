'use client'

/**
 * 列表里「状态」的快捷修改：胶囊旁边一颗**看得出来是按钮**的控件。
 *
 * 为什么要有它：状态列原来只是一枚静态胶囊，没有任何「可切换」的标识，
 * 而状态是这个后台每天改得最多的字段——改一次要进详情页、滚到侧栏、
 * 改下拉、保存，四步。现在列表里一步完成。
 *
 * 两个必须做对的点：
 *   1. 菜单走 portal。工作区面板用了 `overflow: clip` 来裁圆角，
 *      菜单留在单元格里会被整块裁掉。这里按按钮位置用 fixed 定位画到 body 上。
 *   2. 写入走 Payload 自己的 REST（同域 + cookie），成功后 `router.refresh()`
 *      让服务端重取列表；失败给一条提示，不做静默失败——静默失败会让人以为
 *      工单处理了其实没有。
 */

import { toast } from '@payloadcms/ui'
import { Check, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type StatusOption = { label: string; value: string }

export function StatusQuickSelect({
  collectionSlug,
  docId,
  options,
  tone,
  value,
}: {
  collectionSlug: string
  docId: number | string
  options: StatusOption[]
  /** 语义档位（published / scheduled / muted），决定胶囊配色。 */
  tone: string
  value: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // 打开时按按钮位置定位菜单；滚动或改窗口尺寸就关掉（fixed 定位跟不上）。
  useEffect(() => {
    if (!open) return
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect()
      if (!r) return
      const height = 8 + options.length * 32
      const flipUp = r.bottom + height > window.innerHeight - 8
      setPos({ left: Math.min(r.left, window.innerWidth - 176), top: flipUp ? r.top - height - 4 : r.bottom + 4 })
    }
    place()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, options.length])

  const pick = async (next: string) => {
    setOpen(false)
    if (next === value || pending) return
    setPending(true)
    try {
      const res = await fetch(`/api/${collectionSlug}/${docId}`, {
        body: JSON.stringify({ status: next }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null
        throw new Error(body?.message ?? `HTTP ${res.status}`)
      }
      const label = options.find((o) => o.value === next)?.label ?? next
      toast.success(`已改为「${label}」`)
      router.refresh()
    } catch {
      toast.error('状态更新失败，请重试')
    } finally {
      setPending(false)
    }
  }

  const current = options.find((o) => o.value === value)

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`修改状态（当前：${current?.label ?? value}）`}
        className={`admin-status admin-status--${tone} admin-status--actionable`}
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        ref={btnRef}
        type="button"
      >
        {current?.label ?? value}
        <ChevronDown className="admin-status__chevron" />
      </button>

      {open && pos
        ? createPortal(
            <div
              aria-label="选择状态"
              className="admin-status-menu"
              ref={menuRef}
              role="menu"
              style={{ left: pos.left, top: pos.top }}
            >
              {options.map((o) => (
                <button
                  className={`admin-status-menu__item${o.value === value ? ' is-current' : ''}`}
                  key={o.value}
                  onClick={() => void pick(o.value)}
                  role="menuitem"
                  type="button"
                >
                  {o.label}
                  {o.value === value ? <Check className="admin-status__check" /> : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
