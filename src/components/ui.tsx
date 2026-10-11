import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'
import type { ExecutionStatus } from '../engine/types'
import { cn } from '../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent-500 text-white hover:bg-accent-400 shadow-[0_6px_20px_-6px_rgba(59,130,246,0.8)] border border-accent-400/40',
  secondary: 'bg-ink-700 text-ink-100 hover:bg-ink-600 border border-ink-600',
  ghost: 'bg-transparent text-ink-300 hover:bg-ink-800 hover:text-white border border-transparent',
  danger: 'bg-rose-500/90 text-white hover:bg-rose-500 border border-rose-400/40',
  success: 'bg-mint-500 text-ink-950 hover:bg-mint-400 border border-mint-400/40 font-semibold',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
  icon: 'h-9 w-9 p-0',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-ink-700/80 bg-ink-850/70 backdrop-blur-sm',
        'shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function Badge({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode
  className?: string
  tone?: 'neutral' | 'accent' | 'mint' | 'grape' | 'amber' | 'rose'
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-ink-700/70 text-ink-200 border-ink-600',
    accent: 'bg-accent-500/15 text-accent-400 border-accent-500/30',
    mint: 'bg-mint-500/15 text-mint-400 border-mint-500/30',
    grape: 'bg-grape-500/15 text-grape-400 border-grape-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export const STATUS_META: Record<
  ExecutionStatus,
  { label: string; tone: 'neutral' | 'accent' | 'mint' | 'amber' | 'rose'; icon: string }
> = {
  pending: { label: 'Pending', tone: 'neutral', icon: 'Clock' },
  running: { label: 'Running', tone: 'accent', icon: 'Loader2' },
  success: { label: 'Success', tone: 'mint', icon: 'Check' },
  failed: { label: 'Failed', tone: 'rose', icon: 'AlertTriangle' },
  skipped: { label: 'Skipped', tone: 'neutral', icon: 'CircleDot' },
  cancelled: { label: 'Cancelled', tone: 'amber', icon: 'X' },
}

export function StatusBadge({ status, className }: { status: ExecutionStatus; className?: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending
  return (
    <Badge tone={meta.tone} className={className}>
      <Icon name={meta.icon} size={12} className={status === 'running' ? 'animate-spin' : undefined} />
      {meta.label}
    </Badge>
  )
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <Icon name="Loader2" size={size} className={cn('animate-spin', className)} />
}

export function EmptyState({
  icon = 'Boxes',
  title,
  description,
  action,
  className,
}: {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800 text-accent-400">
        <Icon name={icon} size={22} />
      </div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={onClose} />
      <Card className={cn('relative z-10 w-full overflow-hidden', width)}>
        <div className="flex items-start justify-between border-b border-ink-700/80 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-ink-400">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-700 hover:text-white"
            aria-label="Close"
          >
            <Icon name="X" size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-ink-700/80 px-5 py-3">{footer}</div>}
      </Card>
    </div>
  )
}

export function SectionTitle({
  title,
  description,
  right,
}: {
  title: string
  description?: string
  right?: ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {description && <p className="text-xs text-ink-400">{description}</p>}
      </div>
      {right}
    </div>
  )
}

export function Labeled({
  label,
  help,
  children,
  className,
}: {
  label: string
  help?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 flex items-center gap-1 text-xs font-medium text-ink-300">
        {label}
        {help && (
          <span className="group relative inline-flex">
            <Icon name="Info" size={12} className="text-ink-400" />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-52 -translate-x-1/2 rounded-lg border border-ink-600 bg-ink-900 px-2 py-1.5 text-[11px] font-normal text-ink-200 shadow-xl group-hover:block">
              {help}
            </span>
          </span>
        )}
      </span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border border-ink-600 bg-ink-900/80 px-2.5 py-2 text-sm text-white placeholder:text-ink-400/70 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/50'

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputClass, 'min-h-[80px] resize-y font-mono text-xs', props.className)} />
}
