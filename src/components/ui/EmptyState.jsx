import { cn } from '../../utils/cn.js'

export default function EmptyState({ icon: Icon, title, description, action, className, tone = 'neutral' }) {
  const tones = {
    neutral: 'text-faint',
    error: 'text-error/80',
    warning: 'text-warning/80',
  }
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}>
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-edge bg-card">
          <Icon size={22} className={tones[tone]} />
        </div>
      )}
      <div className="max-w-sm">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description && <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
