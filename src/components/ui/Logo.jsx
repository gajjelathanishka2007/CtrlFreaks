import { cn } from '../../utils/cn.js'

/**
 * Synq brand mark — a minimal connected-node symbol representing connected
 * applications and automated workflows. Use `mark` alone where space is tight.
 */
export default function Logo({ size = 32, withWordmark = true, className, wordmarkClass }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        role="img"
        aria-label="Synq"
        className="shrink-0"
      >
        <rect width="48" height="48" rx="12" fill="#0F1318" />
        <rect x="0.5" y="0.5" width="47" height="47" rx="11.5" stroke="#303640" />
        <path
          d="M15 33V23.5C15 21.567 16.567 20 18.5 20H29.5C31.433 20 33 18.433 33 16.5V15"
          stroke="#19E68C"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M15 15H24.5C26.433 15 28 16.567 28 18.5V19"
          stroke="#3B82F6"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="15" cy="33" r="3.6" fill="#19E68C" />
        <circle cx="33" cy="13" r="3.6" fill="#19E68C" />
        <circle cx="15" cy="13" r="3.6" fill="#3B82F6" />
        <circle cx="29" cy="21" r="3.2" fill="#A78BFA" />
      </svg>
      {withWordmark && (
        <span className={cn('text-[17px] font-semibold tracking-tight text-ink', wordmarkClass)}>
          Synq
        </span>
      )}
    </span>
  )
}
