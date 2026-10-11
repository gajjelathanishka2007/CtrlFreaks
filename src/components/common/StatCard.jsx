import { cn } from '../../utils/cn.js'

/** Compact KPI card for the dashboard. */
export default function StatCard({ icon: Icon, label, value, hint, tone = 'neutral', badge, className }) {
  const tones = {
    neutral: 'text-muted bg-elevated',
    neon: 'text-neon bg-neon/12',
    blue: 'text-electric bg-electric/12',
    violet: 'text-violet bg-violet/12',
    error: 'text-error bg-error/12',
    warning: 'text-warning bg-warning/12',
    success: 'text-success bg-success/12',
  }
  return (
    <div className={cn('rounded-2xl border border-edge bg-card p-4 transition hover:border-[#3b424d]', className)}>
      <div className="flex items-center justify-between">
        {Icon && (
          <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', tones[tone])}>
            <Icon size={17} />
          </span>
        )}
        {badge}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-[13px] text-muted">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-faint">{hint}</p>}
    </div>
  )
}
