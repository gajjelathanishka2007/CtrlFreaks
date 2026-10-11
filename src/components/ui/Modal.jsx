import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn.js'
import Tooltip from './Tooltip.jsx'

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

export default function Modal({ open, onClose, title, description, children, footer, size = 'lg', className }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div
        className="animate-synq-fade fixed inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'animate-synq-pop relative z-10 my-auto w-full rounded-2xl border border-edge bg-card shadow-panel outline-none',
          SIZES[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-edge-soft px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          <Tooltip label="Close (Esc)" side="left">
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-elevated hover:text-ink"
            >
              <X size={16} />
            </button>
          </Tooltip>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 synq-scroll">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-edge-soft px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  )
}
