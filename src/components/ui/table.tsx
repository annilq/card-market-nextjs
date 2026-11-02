import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * shadcn/ui 的 Table。行高、字号都按「后台要扫读」调过：
 * 表头 11px 大写字距，正文 13px，行间一条发丝线。
 */
function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="relative w-full overflow-x-auto" data-slot="table-container">
      <table
        className={cn('w-full caption-bottom border-collapse text-[13px]', className)}
        data-slot="table"
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={cn('[&_tr]:border-b [&_tr]:border-border', className)} data-slot="table-header" {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      className={cn('[&_tr:last-child]:border-0', className)}
      data-slot="table-body"
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'border-b border-border/70 transition-colors duration-150 last:border-0 hover:bg-accent/50',
        className,
      )}
      data-slot="table-row"
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'h-8 px-2 text-left align-middle text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase first:pl-0 last:pr-0',
        className,
      )}
      data-slot="table-head"
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      className={cn('px-2 py-2 align-middle first:pl-0 last:pr-0', className)}
      data-slot="table-cell"
      {...props}
    />
  )
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow }
