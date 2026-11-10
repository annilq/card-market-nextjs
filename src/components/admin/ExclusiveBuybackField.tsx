'use client'

import { CheckboxField, useField } from '@payloadcms/ui'
import type { CheckboxFieldClientProps } from 'payload'

/**
 * 两个买取标记互为兄弟：勾上一个，另一个立即取消。
 * 用 field.name 反查兄弟路径，两个字段共用同一个组件。
 */
const SIBLING: Record<string, string> = {
  isHighValue: 'isNoDeduction',
  isNoDeduction: 'isHighValue',
}

/**
 * 后台表单里的互斥勾选。
 *
 * 只在「勾上」时清兄弟：取消勾选不碰兄弟，因此两个都不勾是可达状态。
 * 复用 Payload 原生 CheckboxField，label / description / 校验错误都保持原样。
 */
export function ExclusiveBuybackField(props: CheckboxFieldClientProps) {
  const siblingPath = SIBLING[props.field.name]
  const { setValue } = useField<boolean>({ path: siblingPath })

  if (!siblingPath) return <CheckboxField {...props} />

  return (
    <CheckboxField
      {...props}
      onChange={(next) => {
        if (next) setValue(false)
      }}
    />
  )
}
