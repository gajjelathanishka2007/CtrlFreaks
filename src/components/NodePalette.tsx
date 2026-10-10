import { useMemo, useState } from 'react'
import { listNodeDefinitions } from '../engine/registry'
import type { NodeCategory, NodeType } from '../types/workflow'
import { cn } from '../lib/utils'
import { Icon } from './Icon'
import { CATEGORY_COLOR } from './FlowNode'

const CATEGORY_ORDER: NodeCategory[] = ['trigger', 'data', 'logic', 'action', 'ai']
const CATEGORY_TITLE: Record<NodeCategory, string> = {
  trigger: 'Triggers',
  data: 'Data',
  logic: 'Logic',
  action: 'Actions',
  ai: 'AI',
}

export const NODE_DRAG_TYPE = 'application/ctrl-freaks-node'

export function NodePalette({ onAdd }: { onAdd: (type: NodeType) => void }) {
  const [query, setQuery] = useState('')
  const definitions = useMemo(() => listNodeDefinitions(), [])

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? definitions.filter(
          (d) =>
            d.label.toLowerCase().includes(q) ||
            d.description.toLowerCase().includes(q) ||
            d.type.includes(q),
        )
      : definitions
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: filtered.filter((d) => d.category === category),
    })).filter((group) => group.items.length > 0)
  }, [definitions, query])

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink-700/80 p-3">
        <div className="relative">
          <Icon name="Search" size={14} className="pointer-events-none absolute top-2.5 left-2.5 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes"
            className="w-full rounded-lg border border-ink-600 bg-ink-900/80 py-2 pr-2 pl-8 text-xs text-white placeholder:text-ink-400/70 focus:border-accent-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {grouped.map((group) => (
          <div key={group.category} className="mb-4">
            <p className="mb-1.5 px-1 text-[10px] font-semibold tracking-wider text-ink-400 uppercase">
              {CATEGORY_TITLE[group.category]}
            </p>
            <div className="space-y-1">
              {group.items.map((def) => (
                <button
                  key={def.type}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(NODE_DRAG_TYPE, def.type)
                    event.dataTransfer.effectAllowed = 'move'
                  }}
                  onClick={() => onAdd(def.type)}
                  title="Click to add, or drag onto the canvas"
                  className="group flex w-full cursor-grab items-start gap-2.5 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:border-ink-600 hover:bg-ink-800/80 active:cursor-grabbing"
                >
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${CATEGORY_COLOR[def.category]}22`, color: CATEGORY_COLOR[def.category] }}
                  >
                    <Icon name={def.icon} size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-white">{def.label}</span>
                      {def.demoOnly && (
                        <span className="rounded bg-ink-700 px-1 py-px text-[9px] text-amber-300">DEMO</span>
                      )}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-ink-400">
                      {def.description}
                    </span>
                  </span>
                  <Icon
                    name="Plus"
                    size={14}
                    className={cn('mt-1 shrink-0 text-ink-500 group-hover:text-accent-400')}
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-ink-400">No nodes match “{query}”.</p>
        )}
      </div>
    </div>
  )
}
