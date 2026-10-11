import { cn } from '../../utils/cn.js'

export function SectionCard({ title, description, actions, children, className, bodyClassName, icon: Icon }) {
  return (
    <section className={cn('rounded-2xl border border-edge bg-card', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-edge-soft px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {Icon && <Icon size={16} className="text-faint" />}
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-ink">{title}</h3>
              {description && <p className="truncate text-xs text-muted">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

export default SectionCard
