import { X, Search } from 'lucide-react'
import { cn } from '../../utils/cn.js'

export default function SearchInput({ value, onChange, placeholder = 'Search…', className, autoFocus, onClear }) {
  return (
    <div className={cn('relative', className)}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="synq-input h-9 pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            onClear?.()
          }}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-faint transition hover:bg-elevated hover:text-ink"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
