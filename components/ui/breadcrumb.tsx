import * as React from 'react'
import { ChevronRight, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Breadcrumb({ className, ...props }: React.ComponentProps<'nav'>) {
  return <nav aria-label="breadcrumb" className={cn('flex flex-wrap items-center text-sm text-muted-foreground', className)} {...props} />
}

export function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>) {
  return <ol className={cn('flex flex-wrap items-center gap-1.5 break-words', className)} {...props} />
}

export function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li className={cn('inline-flex items-center gap-1.5', className)} {...props} />
}

export function BreadcrumbLink({
  className,
  asChild,
  children,
  ...props
}: React.ComponentProps<'a'> & { asChild?: boolean }) {
  return (
    <span className={cn('inline-flex items-center transition-colors hover:text-foreground', className)}>
      {children}
    </span>
  )
}

export function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn('font-semibold text-foreground', className)}
      {...props}
    />
  )
}

export function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li role="presentation" aria-hidden="true" className={cn('flex items-center opacity-40 [&>svg]:size-3.5', className)} {...props}>
      {children ?? <ChevronRight className="size-3.5" />}
    </li>
  )
}

export function BreadcrumbEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span role="presentation" aria-hidden="true" className={cn('flex size-6 items-center justify-center', className)} {...props}>
      <MoreHorizontal className="size-4" />
      <span className="sr-only">More</span>
    </span>
  )
}
