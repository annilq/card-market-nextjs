'use client'

import { CheckboxField, useField } from '@payloadcms/ui'
import type { CheckboxFieldClientProps } from 'payload'

/**
 * 三个买取标记同属一组：勾上一个，另外两个立即取消。
 * 用 field.name 反查兄弟路径，三个字段共用同一个组件。
 */
const SIBLINGS: Record<string, readonly [string, string]> = {
  isHighValue: ['isNoDeduction', 'stopBuyback'],
  isNoDeduction: ['isHighValue', 'stopBuyback'],
  stopBuyback: ['isHighValue', 'isNoDeduction'],
}

/**
 * 后台表单里的互斥勾选。
 *
 * 只在「勾上」时清兄弟：取消勾选不碰兄弟，因此三个都不勾是可达状态。
 * 复用 Payload 原生 CheckboxField，label / description / 校验错误都保持原样。
 */
export function ExclusiveBuybackField(props: CheckboxFieldClientProps) {
  const siblings = SIBLINGS[props.field.name]
  // hooks 数量必须固定：没有兄弟路径时退回自身路径，永远调用两次但从不使用。
  const [siblingA, siblingB] = siblings ?? [props.field.name, props.field.name]
  const first = useField<boolean>({ path: siblingA })
  const second = useField<boolean>({ path: siblingB })

  if (!siblings) return <CheckboxField {...props} />

  return (
    <CheckboxField
      {...props}
      onChange={(next) => {
        if (!next) return
        first.setValue(false)
        second.setValue(false)
      }}
    />
  )
}
