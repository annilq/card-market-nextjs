'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * 登录页密码框的明文 / 密文切换。
 *
 * Payload 的 PasswordInput 把 `type="password"` 写死，登录表单里的 PasswordField
 * 也没传 AfterInput / BeforeInput，没有字段级插槽能改这个 input。重写整个
 * views.login 要复制 Payload 的登录表单，升级时最易碎。这里沿用项目已有的做法
 * （见 RichTextToolbarLabels）。在 Provider 里用客户端组件给 Payload 内置 DOM
 * 补一个节点，按钮本身由 React Portal 渲染，事件与图标都归 React 管。
 *
 * PasswordInput 每次输入都会重渲染并重新写一遍 `type="password"`，直接改一次
 * DOM 会被打回。因此由 visibleRef 持有唯一的权威值，再用一个只盯 type 属性的
 * observer 守住它。React 改回 password 就还原，自己写的值已等于目标值不会循环。
 */
const INPUT_SELECTOR = '.login__form #field-password'

function applyType(input: HTMLInputElement, visible: boolean) {
  const wanted = visible ? 'text' : 'password'
  if (input.type !== wanted) input.type = wanted
}

export function LoginPasswordVisibility() {
  const [visible, setVisible] = useState(false)
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)
  const visibleRef = useRef(false)

  useEffect(() => {
    let currentInput: HTMLInputElement | null = null
    let typeObserver: MutationObserver | undefined
    const sync = (input: HTMLInputElement) => applyType(input, visibleRef.current)

    const attach = (input: HTMLInputElement) => {
      if (currentInput !== input) {
        typeObserver?.disconnect()
        currentInput = input
        typeObserver = new MutationObserver(() => sync(input))
        typeObserver.observe(input, { attributes: true, attributeFilter: ['type'] })
      }
      sync(input)
    }

    const apply = () => {
      const input = document.querySelector<HTMLInputElement>(INPUT_SELECTOR)
      if (!input) {
        setSlot((prev) => (prev === null ? prev : null))
        return
      }
      attach(input)

      // 挂在 input 的直接父容器，而不是外层 .field-type__wrap。后者在校验报错时
      // 会多出一行错误提示、高度变大，绝对定位的按钮就会偏到输入行上方。
      const wrap = input.parentElement
      if (!wrap) return
      wrap.classList.add('admin-password-eye-wrap')
      const existing = wrap.querySelector<HTMLDivElement>(':scope > .admin-password-eye-slot')
      if (existing) {
        setSlot((prev) => (prev === existing ? prev : existing))
        return
      }
      const node = document.createElement('div')
      node.className = 'admin-password-eye-slot'
      wrap.appendChild(node)
      setSlot(node)
    }

    apply()

    // 表单可能在水合后才出现，或整块重建。按钮自身的重渲染也会动 body 子树，
    // 用 200ms 节流避免 observer 连锁触发。
    let timer: number | undefined
    const schedule = () => {
      if (timer) return
      timer = window.setTimeout(() => {
        timer = undefined
        apply()
      }, 200)
    }
    const treeObserver = new MutationObserver(schedule)
    treeObserver.observe(document.body, { childList: true, subtree: true })

    return () => {
      treeObserver.disconnect()
      typeObserver?.disconnect()
      if (timer) window.clearTimeout(timer)
      const input = document.querySelector<HTMLInputElement>(INPUT_SELECTOR)
      if (input) applyType(input, false)
    }
  }, [])

  // visible 是 visibleRef 的渲染投影。先更新 ref 再写 DOM，
  // 上面的 type observer 回调读到的永远是同一个权威值。
  useEffect(() => {
    visibleRef.current = visible
    const input = document.querySelector<HTMLInputElement>(INPUT_SELECTOR)
    if (input) applyType(input, visible)
  }, [visible])

  if (!slot) return null

  return createPortal(
    <button
      type="button"
      className="admin-password-eye"
      onClick={() => setVisible((v) => !v)}
      aria-label={visible ? '隐藏密码' : '显示密码'}
      title={visible ? '隐藏密码' : '显示密码'}
      aria-pressed={visible}
    >
      {visible ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
    </button>,
    slot,
  )
}
