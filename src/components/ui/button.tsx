import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * shadcn/ui 的 Button：尺寸与配色都写成变体，调用方只写语义
 * （`variant` / `size`），不再直接拼一串工具类。
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-sm font-medium outline-none transition-[background-color,border-color,box-shadow,color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        secondary:
          'border-border bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
        ghost: 'border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'border-transparent bg-transparent text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-7 px-2.5 text-[13px]',
        lg: 'h-9 px-4',
        icon: 'size-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      data-slot="button"
      {...props}
    />
  )
}

export { Button, buttonVariants }
