'use client'

import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react'
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

  /** 上/下箭头：与拖动共用同一套重排 + 持久化逻辑。 */
  function move(index: number, delta: number) {
    if (saving) return
    const target = index + delta
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    void persist(next)
  }

  const sortable = canUpdate && !saving

  return (
    <div className="admin-no-deduction">
      <div className="admin-no-deduction__header">
        <div className="admin-no-deduction__heading">
          <h1 className="admin-no-deduction__title">不减额买取</h1>
          <p className="admin-no-deduction__hint">拖动排序手柄，或点击 ↑ / ↓ 调整首页展示顺序</p>
        </div>
        <span className="admin-no-deduction__count">共 {total} 张</span>
      </div>

      {message ? (
        <p className="admin-no-deduction__message" role="status">
          {message}
        </p>
      ) : null}

      <div className="admin-no-deduction__table-wrap">
        <table className="admin-no-deduction__table">
          <thead>
            <tr>
              {canUpdate ? <th className="admin-no-deduction__actions-head" scope="col">排序</th> : null}
              <th className="admin-no-deduction__index-head" scope="col">#</th>
              <th scope="col">卡牌名称</th>
              <th scope="col">编号</th>
              <th className="admin-no-deduction__sort-head" scope="col">Sort</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                className={`${dragIndex === index ? 'admin-no-deduction__row--dragging' : ''} ${
                  saving ? 'admin-no-deduction__row--saving' : ''
                }`}
                draggable={sortable}
                key={row.id}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(event) => event.preventDefault()}
                onDragStart={() => setDragIndex(index)}
                onDrop={() => drop(index)}
              >
                {canUpdate ? (
                  <td className="admin-no-deduction__actions">
                    <div className="admin-no-deduction__action-group">
                      <span className="admin-no-deduction__drag-handle" aria-hidden="true" title="拖动排序">
                        <GripVertical size={16} />
                      </span>
                      <div className="admin-no-deduction__arrows">
                        <button
                          aria-label={`上移 ${row.name}`}
                          className="admin-no-deduction__arrow"
                          disabled={!sortable || index === 0}
                          onClick={() => move(index, -1)}
                          title="上移"
                          type="button"
                        >
                          <ArrowUp size={14} aria-hidden="true" />
                        </button>
                        <button
                          aria-label={`下移 ${row.name}`}
                          className="admin-no-deduction__arrow"
                          disabled={!sortable || index === rows.length - 1}
                          onClick={() => move(index, 1)}
                          title="下移"
                          type="button"
                        >
                          <ArrowDown size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </td>
                ) : null}
                <td className="admin-no-deduction__index">{index + 1}</td>
                <td className="admin-no-deduction__name">
                  <Link href={`${adminRoute}/collections/cards/${row.id}`}>{row.name}</Link>
                </td>
                <td className="admin-no-deduction__code">{row.code ?? '—'}</td>
                <td className="admin-no-deduction__sort">{row.sort ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav className="admin-no-deduction__pagination" aria-label="分页">
        <Link
          aria-disabled={page <= 1}
          className={page <= 1 ? 'admin-no-deduction__page-link--disabled' : undefined}
          href={`${adminRoute}/no-deduction-buyback?page=${Math.max(1, page - 1)}`}
        >
          上一页
        </Link>
        <span>
          {page} / {totalPages}
        </span>
        <Link
          aria-disabled={page >= totalPages}
          className={page >= totalPages ? 'admin-no-deduction__page-link--disabled' : undefined}
          href={`${adminRoute}/no-deduction-buyback?page=${Math.min(totalPages, page + 1)}`}
        >
          下一页
        </Link>
      </nav>
    </div>
  )
}

export default NoDeductionList
