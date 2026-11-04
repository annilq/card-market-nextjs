'use client'

import { useAuth } from '@payloadcms/ui'
import { useState, type CSSProperties, type FormEvent } from 'react'

/**
 * 首次登录强制改密守卫（遮罩式）。
 *
 * 读 auth 上下文里的 `forcePasswordChange`：为真时盖一层全屏遮罩 + 居中模态框，
 * 底层后台 UI 被遮罩挡住、无法操作，用户必须先改成自己的密码才能进入工作区。
 *
 * 提交走账号「本人自更新」接口（`/api/users/<id>` PATCH，access 已放行本人 update），
 * 成功后 beforeChange 钩子把 `forcePasswordChange` 清零；这里用 `refreshCookieAsync()`
 * 让 Payload 拿 DB 里的新用户重新签发 token，auth 上下文里的 `forcePasswordChange`
 * 随之变 false、守卫自动消失。注意：不能用整页刷新——旧 token 里仍写着 true，
 * 重载回来守卫会再次出现。详见 docs/specs/2026-11-04-back-office-account-auth.md。
 */
export function ForcePasswordChangeGuard() {
  const { user, refreshCookieAsync } = useAuth()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 未登录 / 不需要强制改密 → 不渲染任何东西（也不会挡住登录页本身）。
  if (!user || !user.forcePasswordChange) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('密码至少 6 位')
      return
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { errors?: { message?: string }[] }
        const msg = data.errors?.[0]?.message || '修改失败，请重试'
        throw new Error(msg)
      }

      // 钩子已把 DB 里的 forcePasswordChange 清零，重新签发 token，
      // auth 上下文的 user 随之更新、forcePasswordChange 变 false，守卫自动消失。
      await refreshCookieAsync()
      setSubmitting(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败，请重试')
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fp-guard-title"
      style={overlayStyle}
    >
      <form onSubmit={handleSubmit} style={cardStyle}>
        <h2 id="fp-guard-title" style={titleStyle}>
          请设置您自己的密码
        </h2>
        <p style={descStyle}>
          管理员为您分配了初始密码。出于安全，首次登录必须先修改为本人密码，之后才能进入后台。
        </p>

        <label style={labelStyle}>
          新密码
          <input
            type="password"
            value={password}
            autoFocus
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          确认新密码
          <input
            type="password"
            value={confirm}
            autoComplete="new-password"
            onChange={(e) => setConfirm(e.target.value)}
            style={inputStyle}
          />
        </label>

        {error ? <p style={errorStyle}>{error}</p> : null}

        <button type="submit" disabled={submitting} style={buttonStyle(submitting)}>
          {submitting ? '提交中…' : '确认修改并进入'}
        </button>
      </form>
    </div>
  )
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'rgba(15, 23, 42, 0.72)',
  backdropFilter: 'blur(2px)',
}

const cardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 380,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: 28,
  borderRadius: 12,
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)',
  background: 'var(--theme-bg, #ffffff)',
  color: 'var(--theme-text, #0f172a)',
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 700,
}

const descStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.5,
  opacity: 0.8,
}

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
}

const inputStyle: CSSProperties = {
  height: 40,
  padding: '0 12px',
  fontSize: 14,
  borderRadius: 8,
  outline: 'none',
  color: 'inherit',
  background: 'var(--theme-input-bg, #ffffff)',
  border: '1px solid var(--theme-border-color, #cbd5e1)',
}

const errorStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: '#dc2626',
}

function buttonStyle(disabled: boolean): CSSProperties {
  return {
    height: 42,
    marginTop: 4,
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none',
    color: '#ffffff',
    background: disabled ? '#9ca3af' : 'var(--theme-primary, #b91c1c)',
  }
}
