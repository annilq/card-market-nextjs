import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 类名合并：`clsx` 负责条件拼接，`tailwind-merge` 负责把冲突的 Tailwind
 * 工具类按「后者胜」归并（例如外部传入的 `px-6` 要盖掉组件默认的 `px-4`）。
 * 这是 shadcn/ui 组件能安全地被外部覆盖样式的前提。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
