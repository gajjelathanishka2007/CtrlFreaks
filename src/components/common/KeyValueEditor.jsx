import { Plus, Trash2 } from 'lucide-react'
import { cn } from '../../utils/cn.js'

/** Editable list of key → value rows used by mapping/header/rule fields. */
export default function KeyValueEditor({ value = [], onChange, keyPlaceholder = 'field', valuePlaceholder = 'value', addLabel = 'Add row', className }) {
  const rows = Array.isArray(value) ? value : []

  const update = (i, patch) => {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  const add = () => onChange([...rows, { key: '', value: '' }])
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i))

  return (
    <div className={cn('space-y-1.5', className)}>
      {rows.length === 0 && <p className="text-[11px] text-faint">No entries yet.</p>}
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            value={row.key || ''}
            onChange={(e) => update(i, { key: e.target.value })}
            placeholder={keyPlaceholder}
            className="synq-input h-8 flex-1 font-mono text-xs"
          />
          <span className="text-faint">→</span>
          <input
            value={row.value || ''}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder={valuePlaceholder}
            className="synq-input h-8 flex-1 font-mono text-xs"
          />
          <button
            onClick={() => remove(i)}
            aria-label="Remove row"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-error/12 hover:text-error"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-edge px-2.5 py-1.5 text-[11px] text-muted transition hover:border-neon/40 hover:text-neon"
      >
        <Plus size={12} /> {addLabel}
      </button>
    </div>
  )
}
