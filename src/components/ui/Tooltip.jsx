import { cn } from '../../utils/cn.js'

const SIDES = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

/**
 * Lightweight tooltip for icon-only controls. Shown on hover and keyboard focus.
 */
export default function Tooltip({ label, children, side = 'top', className, disabled = false }) {
  if (!label || disabled) return children
  return (
    <span className={cn('group/tt relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-md border border-edge bg-elevated px-2 py-1 text-[11px] font-medium text-ink shadow-panel',
          'group-hover/tt:block group-focus-within/tt:block',
          SIDES[side],
        )}
      >
        {label}
      </span>
    </span>
  )
}
