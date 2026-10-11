import { Fragment } from 'react'

/** Minimal inline markdown: **bold**, `code`, _italic_. */
function renderInline(text) {
  const parts = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g
  let last = 0
  let m
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(<Fragment key={i++}>{text.slice(last, m.index)}</Fragment>)
    const tok = m[0]
    if (tok.startsWith('**')) {
      parts.push(
        <strong key={i++} className="font-semibold text-ink">
          {tok.slice(2, -2)}
        </strong>,
      )
    } else if (tok.startsWith('`')) {
      parts.push(
        <code key={i++} className="rounded bg-black/40 px-1 py-0.5 font-mono text-[11px] text-neon">
          {tok.slice(1, -1)}
        </code>,
      )
    } else {
      parts.push(
        <em key={i++} className="text-faint">
          {tok.slice(1, -1)}
        </em>,
      )
    }
    last = m.index + tok.length
  }
  if (last < text.length) parts.push(<Fragment key={i++}>{text.slice(last)}</Fragment>)
  return parts
}

/** Renders a block of assistant text: paragraphs, bullet/numbered lists, headings. */
export default function RichText({ text }) {
  const lines = String(text || '').split('\n')
  const blocks = []
  let list = null

  const flush = () => {
    if (list) {
      blocks.push(list)
      list = null
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const ul = /^[-*]\s+/.test(line)
    const ol = /^\d+\.\s+/.test(line)
    const heading = /^#{1,4}\s+/.test(line)

    if (ul || ol) {
      const type = ul ? 'ul' : 'ol'
      if (!list || list.type !== type) {
        flush()
        list = { type, items: [] }
      }
      list.items.push(line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''))
      continue
    }

    flush()
    if (line === '') {
      blocks.push({ type: 'spacer' })
    } else if (heading) {
      blocks.push({ type: 'heading', text: line.replace(/^#{1,4}\s+/, '') })
    } else {
      blocks.push({ type: 'p', text: line })
    }
  }
  flush()

  return (
    <div className="space-y-1.5 text-[12.5px] leading-relaxed text-muted">
      {blocks.map((b, i) => {
        if (b.type === 'spacer') return <div key={i} className="h-1" />
        if (b.type === 'heading')
          return (
            <p key={i} className="mt-1 text-[13px] font-semibold text-ink">
              {renderInline(b.text)}
            </p>
          )
        if (b.type === 'p')
          return (
            <p key={i}>{renderInline(b.text)}</p>
          )
        if (b.type === 'ul')
          return (
            <ul key={i} className="ml-1 space-y-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neon/70" />
                  <span>{renderInline(it)}</span>
                </li>
              ))}
            </ul>
          )
        if (b.type === 'ol')
          return (
            <ol key={i} className="ml-1 space-y-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="shrink-0 font-mono text-[11px] text-neon/80">{j + 1}.</span>
                  <span>{renderInline(it)}</span>
                </li>
              ))}
            </ol>
          )
        return null
      })}
    </div>
  )
}
