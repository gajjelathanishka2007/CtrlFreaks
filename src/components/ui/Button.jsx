import { cn } from '../../utils/cn.js'
import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary:
    'bg-neon text-[#04140D] font-semibold hover:brightness-110 active:brightness-95 shadow-[0_0_0_1px_rgba(25,230,140,0.35),0_6px_18px_-8px_rgba(25,230,140,0.7)]',
  secondary: 'bg-elevated text-ink border border-edge hover:bg-[#232a33]',
  outline: 'border border-edge text-muted hover:text-ink hover:border-[#3b424d] hover:bg-elevated/60',
  ghost: 'text-muted hover:text-ink hover:bg-elevated/70',
  danger: 'bg-error/12 text-error border border-error/40 hover:bg-error/20',
  ai: 'bg-violet/15 text-violet border border-violet/40 hover:bg-violet/25',
  blue: 'bg-electric/15 text-electric border border-electric/40 hover:bg-electric/25',
}

const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-10 px-4 text-sm gap-2 rounded-lg',
  icon: 'h-9 w-9 rounded-lg',
  iconSm: 'h-8 w-8 rounded-lg',
}

export default function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className,
  loading = false,
  disabled = false,
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 size={size === 'xs' || size === 'sm' ? 13 : 15} className="animate-spin" />}
      {children}
    </button>
  )
}
