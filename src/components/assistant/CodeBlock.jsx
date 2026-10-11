import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { highlightCode } from '../../utils/highlight.js'
import { cn } from '../../utils/cn.js'

/** Fenced code block with syntax highlighting and a Copy button. */
export default function CodeBlock({ code, language = 'javascript', className }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className={cn('group my-2 overflow-hidden rounded-xl border border-edge bg-base/70', className)}>
      <div className="flex items-center justify-between border-b border-edge-soft bg-black/20 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wide text-faint">{language}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted transition hover:bg-elevated hover:text-ink"
        >
          {copied ? <Check size={12} className="text-neon" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[11.5px] leading-relaxed synq-scroll">
        <code dangerouslySetInnerHTML={{ __html: highlightCode(code, language) }} />
      </pre>
    </div>
  )
}
