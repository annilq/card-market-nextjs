import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * 状态徽章。语义色（绿 / 琥珀 / 中性）走 `variant`，
 * 不再在页里手写 `bg-emerald-100 text-emerald-700`。
 */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-normal [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary-soft text-primary-soft-fg',
        success: 'border-transparent bg-emerald-500/12 text-emerald-800 dark:text-emerald-300',
        warning: 'border-transparent bg-amber-500/14 text-amber-800 dark:text-amber-300',
        muted: 'border-border bg-muted text-muted-foreground',
        outline: 'border-border bg-transparent text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return <Comp className={cn(badgeVariants({ variant }), className)} data-slot="badge" {...props} />
}

export { Badge, badgeVariants }
