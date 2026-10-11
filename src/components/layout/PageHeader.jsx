import { cn } from '../../utils/cn.js'

export default function PageHeader({ title, subtitle, actions, className, children }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Scrolling page region with consistent padding. */
export function PageBody({ children, className }) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto synq-scroll', className)}>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
    </div>
  )
}
