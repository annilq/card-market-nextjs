'use client'

import { GripVertical } from 'lucide-react'
import Link from 'next/link'
import React, { useState } from 'react'

type CardRow = { id: number; name: string; code: string | null; sort: number | null }

type Props = {
  adminRoute: string
  apiRoute: string
  canUpdate: boolean
  cards: CardRow[]
  page: number
  totalPages: number
  total: number
}

export function NoDeductionList({ adminRoute, apiRoute, canUpdate, cards, page, totalPages, total }: Props) {
  const [rows, setRows] = useState(cards)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function persist(next: CardRow[]) {
    if (!canUpdate) return
    setSaving(true)
    setMessage(null)
    try {
      for (let index = 0; index < next.length; index += 1) {
        const row = next[index]
        const response = await fetch(`${apiRoute}/cards/${row.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort: index + 1 }),
        })
        if (!response.ok) throw new Error(`保存第 ${index + 1} 条失败`)
      }
      setRows(next)
      setMessage('排序已保存')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '排序保存失败')
    } finally {
      setSaving(false)
    }
  }

  function drop(target: number) {
    if (dragIndex == null || dragIndex === target) {
      setDragIndex(null)
      return
    }
    const next = [...rows]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(target, 0, moved)
    setDragIndex(null)
    void persist(next)
  }

  return (
    <div className="admin-no-deduction">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">不减额买取</h1>
        <span className="text-sm text-muted-foreground">共 {total} 张，按 sort 升序拖动排序</span>
      </div>

      {message ? <p className="mb-3 text-sm" role="status">{message}</p> : null}

      <ul className="divide-y divide-border rounded-md border border-border">
        {rows.map((row, index) => (
          <li
            className={`flex items-center gap-3 px-3 py-2 ${dragIndex === index ? 'opacity-40' : ''}`}
            draggable={canUpdate && !saving}
            key={row.id}
            onDragEnd={() => setDragIndex(null)}
            onDragOver={(event) => event.preventDefault()}
            onDragStart={() => setDragIndex(index)}
            onDrop={() => drop(index)}
          >
            {canUpdate ? <GripVertical aria-hidden="true" className="size-4 text-muted-foreground" /> : null}
            <span className="w-8 text-right text-xs text-muted-foreground">{index + 1}</span>
            <Link className="flex-1 hover:underline" href={`${adminRoute}/collections/cards/${row.id}`}>
              {row.name}
            </Link>
            <span className="text-xs text-muted-foreground">{row.code ?? '—'}</span>
            <span className="w-12 text-right text-xs text-muted-foreground">{row.sort ?? '—'}</span>
          </li>
        ))}
      </ul>

      <nav className="mt-4 flex items-center gap-3 text-sm">
        <Link aria-disabled={page <= 1} href={`${adminRoute}/no-deduction-buyback?page=${Math.max(1, page - 1)}`}>
          上一页
        </Link>
        <span>{page} / {totalPages}</span>
        <Link aria-disabled={page >= totalPages} href={`${adminRoute}/no-deduction-buyback?page=${Math.min(totalPages, page + 1)}`}>
          下一页
        </Link>
      </nav>
    </div>
  )
}

export default NoDeductionList
