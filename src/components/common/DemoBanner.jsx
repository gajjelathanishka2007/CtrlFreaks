import { FlaskConical, Info } from 'lucide-react'
import { cn } from '../../utils/cn.js'
import { USE_MOCK } from '../../services/api.js'

/**
 * Honest status banner. Shown whenever data is coming from the mock layer
 * instead of a live backend, so nothing is mistaken for real data.
 */
export default function DemoBanner({ className, compact = false, children }) {
  if (!USE_MOCK) return null
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-xl border border-electric/30 bg-electric/8 px-3.5 py-2.5 text-electric',
        className,
      )}
    >
      {compact ? <Info size={15} className="mt-0.5 shrink-0" /> : <FlaskConical size={16} className="mt-0.5 shrink-0" />}
      <p className="text-xs leading-relaxed">
        {children || (
          <>
            <span className="font-semibold">Demo mode.</span> The backend is not connected, so this screen shows sample
            data. Set <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px]">VITE_USE_MOCK=false</code>{' '}
            and start the API to use live data.
          </>
        )}
      </p>
    </div>
  )
}
