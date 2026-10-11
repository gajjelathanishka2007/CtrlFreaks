import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '../../utils/cn.js'

/** Pretty-printed JSON viewer with copy-to-clipboard. */
export default function JsonBlock({ value, className, maxHeight = 'none' }) {
  const [copied, setCopied] = useState(false)
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className={cn('group relative rounded-xl border border-edge-soft bg-base/60', className)}>
      <button
        onClick={copy}
        aria-label="Copy JSON"
        className="absolute right-2 top-2 z-10 flex h-7 items-center gap-1 rounded-md border border-edge bg-elevated px-2 text-[11px] text-muted opacity-0 transition hover:text-ink group-hover:opacity-100 focus:opacity-100"
      >
        {copied ? <Check size={12} className="text-neon" /> : <Copy size={12} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre
        className="overflow-auto p-3 font-mono text-[11.5px] leading-relaxed text-muted synq-scroll"
        style={{ maxHeight }}
      >
        {text}
      </pre>
    </div>
  )
}
