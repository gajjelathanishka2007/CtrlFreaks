import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { AlertTriangle, CheckCircle2, Loader2, XCircle, CircleDot } from 'lucide-react'
import { ACCENTS, getNodeDef } from '../../data/nodeCatalog.js'
import { cn } from '../../utils/cn.js'

const STATUS_STYLES = {
  success: { ring: 'ring-success/50', chip: 'text-success bg-success/12', Icon: CheckCircle2, label: 'Success' },
  failed: { ring: 'ring-error/60', chip: 'text-error bg-error/12', Icon: XCircle, label: 'Failed' },
  error: { ring: 'ring-error/60', chip: 'text-error bg-error/12', Icon: XCircle, label: 'Error' },
  warning: { ring: 'ring-warning/50', chip: 'text-warning bg-warning/12', Icon: AlertTriangle, label: 'Warning' },
  running: { ring: 'ring-electric/50', chip: 'text-electric bg-electric/12', Icon: Loader2, label: 'Running' },
  skipped: { ring: 'ring-edge', chip: 'text-faint bg-elevated', Icon: CircleDot, label: 'Skipped' },
}

function Handles({ def, highlight }) {
  const accent = ACCENTS[def.accent] || ACCENTS.blue
  const inputs = def.inputs || []
  const outputs = def.outputs || []
  const outputsAreBranches = Array.isArray(def.branches) && def.branches.length > 0

  return (
    <>
      {inputs.map((input, i) => {
        const top = ((i + 1) / (inputs.length + 1)) * 100
        return (
          <Handle
            key={`in-${input.name}`}
            id={input.name}
            type="target"
            position={Position.Left}
            style={{ top: `${top}%` }}
            className={cn('!bg-elevated !border-edge', highlight && '!border-neon')}
          />
        )
      })}

      {outputsAreBranches
        ? def.branches.map((branch, i) => {
            const top = ((i + 1) / (def.branches.length + 1)) * 100
            return (
              <div key={branch}>
                <Handle
                  id={branch}
                  type="source"
                  position={Position.Right}
                  style={{ top: `${top}%` }}
                  className={cn('!bg-violet !border-[#0b0e11]')}
                />
                <span
                  className="pointer-events-none absolute right-4 -translate-y-1/2 text-[9px] font-semibold uppercase tracking-wide text-violet/80"
                  style={{ top: `${top}%` }}
                >
                  {branch}
                </span>
              </div>
            )
          })
        : outputs.map((output, i) => {
            const top = ((i + 1) / (outputs.length + 1)) * 100
            return (
              <Handle
                key={`out-${output.name}`}
                id={output.name}
                type="source"
                position={Position.Right}
                style={{ top: `${top}%` }}
                className={cn('!bg-neon !border-[#0b0e11]')}
              />
            )
          })}
    </>
  )
}

function SynqNode({ data, selected, type }) {
  const def = getNodeDef({ type, data })
  if (!def) {
    return (
      <div className="w-[200px] rounded-xl border border-error/50 bg-card p-3 text-xs text-error">
        Unknown node type
      </div>
    )
  }

  const accent = ACCENTS[def.accent] || ACCENTS.blue
  const Icon = def.icon
  const status = data?.status
  const statusStyle = status ? STATUS_STYLES[status] : null
  const inCount = def.inputs?.length || 0
  const outCount = def.outputs?.length || 0

  return (
    <div
      className={cn(
        'group w-[248px] rounded-xl border bg-card shadow-panel transition',
        accent.border,
        selected ? cn('ring-2', statusStyle ? statusStyle.ring : 'ring-neon/60') : 'hover:border-[#3f4650]',
        statusStyle && cn('ring-1', statusStyle.ring),
      )}
    >
      <Handles def={def} highlight={selected} />

      {/* Header */}
      <div className={cn('flex items-center gap-2.5 rounded-t-xl px-3 py-2.5', accent.bg)}>
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/30', accent.text)}>
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{data?.label || def.name}</p>
          <p className={cn('truncate text-[10px] font-medium uppercase tracking-wide', accent.text)}>
            {def.category}
          </p>
        </div>
        {statusStyle && (
          <span className={cn('flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium', statusStyle.chip)}>
            <statusStyle.Icon size={10} className={status === 'running' ? 'animate-spin' : ''} />
            {statusStyle.label}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2.5">
        <p className="line-clamp-2 text-[11px] leading-relaxed text-muted">{def.description}</p>
      </div>

      {/* IO footer */}
      <div className="flex items-center justify-between gap-2 border-t border-edge-soft px-3 py-2 text-[10px]">
        <span className="min-w-0 truncate text-faint">
          <span className="text-muted">{inCount}</span> in
          {inCount > 0 && <span className="text-faint/70"> · {(def.inputs || []).map((i) => i.name).join(', ')}</span>}
        </span>
        <span className="min-w-0 truncate text-right text-faint">
          {outCount > 0 && <span className="text-faint/70">{(def.outputs || []).map((o) => o.name).join(', ')} · </span>}
          <span className="text-muted">{outCount}</span> out
        </span>
      </div>

      {data?.executionNote && (
        <div className="border-t border-edge-soft px-3 py-1.5 text-[10px] text-warning">{data.executionNote}</div>
      )}
    </div>
  )
}

export default memo(SynqNode)
