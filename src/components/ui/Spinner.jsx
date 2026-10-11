import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/cn.js'

export default function Spinner({ size = 18, className }) {
  return <Loader2 size={size} className={cn('animate-spin text-neon', className)} />
}

export function LoadingBlock({ label = 'Loading…', className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-muted', className)}>
      <Spinner size={22} />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function SkeletonRows({ rows = 4, className }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl border border-edge-soft bg-card/60" />
      ))}
    </div>
  )
}
