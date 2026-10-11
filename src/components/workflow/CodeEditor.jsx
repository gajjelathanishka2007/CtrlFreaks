import { useMemo, useRef } from 'react'
import { highlightCode } from '../../utils/highlight.js'
import { cn } from '../../utils/cn.js'

/**
 * Editable code area with line numbers and syntax highlighting.
 * A transparent <textarea> sits over a highlighted <pre>; both share identical
 * font metrics so the caret and colours line up. Scroll is kept in sync.
 */
export default function CodeEditor({
  value = '',
  onChange,
  language = 'javascript',
  readOnly = false,
  height = 260,
  className,
  ariaLabel = 'Code editor',
}) {
  const preRef = useRef(null)
  const gutterRef = useRef(null)
  const taRef = useRef(null)

  const html = useMemo(() => highlightCode(value, language), [value, language])
  const lineCount = Math.max(1, value.split('\n').length)

  const handleScroll = (e) => {
    const { scrollTop, scrollLeft } = e.currentTarget
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop
      preRef.current.scrollLeft = scrollLeft
    }
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Tab' && !readOnly) {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const next = `${value.slice(0, start)}  ${value.slice(end)}`
      onChange?.(next)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    }
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border border-edge bg-base/70', className)}>
      <div
        className="relative flex font-mono"
        style={{ height, fontSize: '12px', lineHeight: '19px' }}
      >
        {/* Line numbers */}
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="relative z-10 w-10 shrink-0 select-none overflow-hidden border-r border-edge-soft bg-black/25 text-right"
        >
          <div className="py-3 pr-2">
            {Array.from({ length: lineCount }).map((_, i) => (
              <div key={i} className="text-faint" style={{ height: '19px' }}>
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Editor surface */}
        <div className="relative min-w-0 flex-1">
          <pre
            ref={preRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre px-3 py-3"
          >
            <code dangerouslySetInnerHTML={{ __html: html + '\n' }} />
          </pre>
          <textarea
            ref={taRef}
            value={value}
            readOnly={readOnly}
            spellCheck={false}
            aria-label={ariaLabel}
            onChange={(e) => onChange?.(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            className={cn(
              'absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent px-3 py-3 text-transparent caret-neon outline-none synq-scroll',
              readOnly && 'cursor-default',
            )}
          />
        </div>
      </div>
    </div>
  )
}
