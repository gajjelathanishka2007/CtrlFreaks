import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ExecutionStatus } from '../engine/types'
import type { NodeCategory, NodeType } from '../types/workflow'
import { cn } from '../lib/utils'
import { Icon } from './Icon'

export interface FlowNodeData {
  label: string
  nodeType: NodeType
  category: NodeCategory
  icon: string
  disabled?: boolean
  demoOnly?: boolean
  ports: { id: string; label: string }[]
  hasInput: boolean
  status?: ExecutionStatus
  durationMs?: number
}

export const CATEGORY_COLOR: Record<NodeCategory, string> = {
  trigger: '#34e0b0',
  data: '#6ea8ff',
  logic: '#b07cff',
  action: '#fbbf24',
  ai: '#f472b6',
}

const CATEGORY_LABEL: Record<NodeCategory, string> = {
  trigger: 'Trigger',
  data: 'Data',
  logic: 'Logic',
  action: 'Action',
  ai: 'AI',
}

const STATUS_RING: Partial<Record<ExecutionStatus, string>> = {
  success: 'ring-2 ring-mint-400/70',
  failed: 'ring-2 ring-rose-500/80',
  running: 'ring-2 ring-accent-400 animate-pulse',
  skipped: 'opacity-50',
}

export function FlowNode({ data, selected }: NodeProps) {
  const d = data as unknown as FlowNodeData
  const color = CATEGORY_COLOR[d.category] ?? '#6ea8ff'
  const ports = d.ports ?? []

  return (
    <div
      className={cn(
        'group relative w-56 rounded-xl border bg-ink-850/95 shadow-lg transition-all',
        selected ? 'border-accent-400 ring-2 ring-accent-400/40' : 'border-ink-600',
        d.status ? STATUS_RING[d.status] : undefined,
        'hover:border-ink-400',
      )}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {d.hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          style={{ background: color, borderColor: '#0b0f1a' }}
        />
      )}

      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${color}22`, color }}
        >
          <Icon name={d.icon} size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[13px] font-semibold text-white">{d.label}</p>
            {d.disabled && <span className="text-[10px] text-ink-400">(off)</span>}
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] tracking-wide text-ink-400 uppercase">
            {CATEGORY_LABEL[d.category]}
            {d.demoOnly && <span className="rounded bg-ink-700 px-1 py-px text-[9px] text-amber-300">DEMO</span>}
          </p>
        </div>
      </div>

      {d.status === 'failed' && (
        <div className="mx-3 mb-2 flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-1 text-[10px] text-rose-300">
          <Icon name="AlertTriangle" size={11} /> failed
        </div>
      )}

      {ports.map((port, index) => {
        const top = ((index + 1) / (ports.length + 1)) * 100
        const showLabel = ports.length > 1
        return (
          <div key={port.id}>
            <Handle
              type="source"
              position={Position.Right}
              id={port.id}
              style={{ top: `${top}%`, background: color, borderColor: '#0b0f1a' }}
            />
            {showLabel && (
              <span
                className="pointer-events-none absolute right-4 -translate-y-1/2 text-[9px] font-medium text-ink-300"
                style={{ top: `${top}%` }}
              >
                {port.label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export const nodeTypes = { cf: FlowNode }
