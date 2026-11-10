'use client'

import { FieldLabel, useTranslation } from '@payloadcms/ui'
import { Info } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type Tip = { zh: string; en: string; ja: string }

type Props = {
  /** Payload 传给自定义 Label 的 clientProps.field，label 仍为 {zh,en,ja}。 */
  field?: { label?: string | Record<string, string>; required?: boolean }
  path?: string
  tip: Tip
}

/**
 * 「排序」字段的标签：原生 FieldLabel 旁挂一枚说明气泡。
 * 公告与卡牌共用，文案由字段配置的 clientProps.tip 传入。
 */
export function SortFieldLabel({ field, path, tip }: Props) {
  const { i18n } = useTranslation()
  const text = tip[i18n.language as keyof Tip] ?? tip.zh

  return (
    <span className="inline-flex items-center gap-1">
      <FieldLabel label={field?.label} path={path} required={field?.required} />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={text}
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted"
          >
            <Info size={13} aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    </span>
  )
}
