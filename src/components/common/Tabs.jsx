import { cn } from '../../utils/cn.js'

/**
 * Horizontal scrollable tab/segmented control used by the Add Node popover,
 * execution filters, and settings sections.
 */
export default function Tabs({ tabs, value, onChange, className, size = 'md', scroll = false }) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center gap-1',
        scroll && 'overflow-x-auto synq-scroll',
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.id === value
        const Icon = t.icon
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-lg font-medium transition',
              size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]',
              active
                ? 'bg-neon/12 text-neon'
                : 'text-muted hover:bg-elevated/70 hover:text-ink',
            )}
          >
            {Icon && <Icon size={14} />}
            {t.label}
            {t.count != null && (
              <span className={cn('rounded-full px-1.5 text-[10px]', active ? 'bg-neon/20' : 'bg-elevated text-faint')}>
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
