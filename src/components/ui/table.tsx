import type { ReactNode, HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

// Names the table convention that already existed ad hoc in
// ticket-list-view.tsx / rrhh views (card chrome + horizontal scroll on
// narrow viewports, gray-50 header, divide-y rows) so new tables don't
// reinvent slightly different versions of it.
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
      {children}
    </thead>
  )
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-gray-100">{children}</tbody>
}

export function Tr({ children, className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn(rest.onClick && 'cursor-pointer transition-colors hover:bg-gray-50', className)} {...rest}>
      {children}
    </tr>
  )
}

export function Th({ children, className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn('px-4 py-3 text-left font-semibold', className)} {...rest}>
      {children}
    </th>
  )
}

export function Td({ children, className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-4 py-3 text-gray-700', className)} {...rest}>
      {children}
    </td>
  )
}

/** Empty-state row spanning the full table width — pass the real column count. */
export function TableEmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-gray-400">
        {children}
      </td>
    </tr>
  )
}
