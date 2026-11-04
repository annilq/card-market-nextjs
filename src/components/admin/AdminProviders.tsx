import type { ReactNode } from 'react'

import { RichTextToolbarLabels } from './RichTextToolbarLabels'
import { ForcePasswordChangeGuard } from './ForcePasswordChangeGuard'
import { TooltipProvider } from '@/components/ui/tooltip'

import './admin-ui.css'

/**
 * 后台全局 Provider。
 *
 * 挂在这里而不是改 `app/(payload)/layout.tsx`——那份文件是 Payload 生成的，
 * 升级时会被整份重写，写进去的 import 会静默消失。
 *
 * 它做两件事：
 *   1. 把 `admin-ui.css`（Tailwind 变量 + shadcn 令牌）带进后台 bundle；
 *   2. 提供一个 Radix Tooltip 的 Provider；
 *   3. 给富文本工具条的按钮补名字（RichTextToolbarLabels）。
 */
export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={250}>
      {/* 富文本工具条是「聚焦编辑器才挂载」的，这个组件跟着给它补名字
          （Payload 的按钮只有图标，没有 aria-label 也没有 title） */}
      <RichTextToolbarLabels />
      {/* 首次登录强制改密守卫：遮罩式，必须先改密才能进入后台（见组件注释）。 */}
      <ForcePasswordChangeGuard />
      {children}
    </TooltipProvider>
  )
}
