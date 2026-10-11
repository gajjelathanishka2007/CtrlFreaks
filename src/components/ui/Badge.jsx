import { cn } from '../../utils/cn.js'

const TONES = {
  neutral: 'bg-elevated text-muted border-edge',
  neon: 'bg-neon/12 text-neon border-neon/35',
  blue: 'bg-electric/12 text-electric border-electric/35',
  violet: 'bg-violet/12 text-violet border-violet/35',
  success: 'bg-success/12 text-success border-success/35',
  error: 'bg-error/12 text-error border-error/35',
  warning: 'bg-warning/12 text-warning border-warning/35',
}

export default function Badge({ children, tone = 'neutral', className, dot = false }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/** Status → tone map reused across executions, nodes, and simulations. */
export const STATUS_TONES = {
  success: 'success',
  pass: 'success',
  active: 'success',
  running: 'blue',
  published: 'success',
  warning: 'warning',
  warn: 'warning',
  paused: 'warning',
  pending: 'warning',
  failed: 'error',
  fail: 'error',
  error: 'error',
  skipped: 'neutral',
  draft: 'neutral',
  idle: 'neutral',
}
