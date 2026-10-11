import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Workflow as WorkflowIcon,
  Pencil,
  Trash2,
  Rocket,
  Check,
  X,
  Play,
  FlaskConical,
} from 'lucide-react'
import { StatusPill } from '../ui/index.js'
import Tooltip from '../ui/Tooltip.jsx'
import Button from '../ui/Button.jsx'
import { cn } from '../../utils/cn.js'
import { formatRelative } from '../../utils/format.js'

export default function WorkflowCard({ workflow, onRename, onPublish, onDelete, onTest }) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(workflow.name)
  const [busy, setBusy] = useState(false)

  const commit = async () => {
    const name = draft.trim() || workflow.name
    setEditing(false)
    if (name !== workflow.name) {
      setBusy(true)
      await onRename(workflow.id, name)
      setBusy(false)
    }
  }

  return (
    <div className="group flex flex-col rounded-2xl border border-edge bg-card p-4 transition hover:border-[#3b424d] hover:shadow-panel">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-edge bg-elevated text-muted transition group-hover:border-neon/40 group-hover:text-neon">
          <WorkflowIcon size={16} />
        </span>
        <StatusPill status={workflow.status} />
      </div>

      <div className="mt-3 min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') {
                  setDraft(workflow.name)
                  setEditing(false)
                }
              }}
              className="synq-input h-8 text-sm"
            />
            <button
              onClick={commit}
              aria-label="Save name"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neon/15 text-neon hover:bg-neon/25"
            >
              <Check size={15} />
            </button>
            <button
              onClick={() => {
                setDraft(workflow.name)
                setEditing(false)
              }}
              aria-label="Cancel rename"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate(`/workflows/${workflow.id}`)}
            className="block max-w-full truncate text-left text-[15px] font-semibold text-ink transition hover:text-neon"
            title={workflow.name}
          >
            {workflow.name}
          </button>
        )}
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
          {workflow.description || 'No description yet.'}
        </p>
      </div>

      {/* Meta */}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-edge-soft pt-3 text-center">
        <Metric label="Nodes" value={workflow.nodes ?? 0} />
        <Metric label="Runs" value={workflow.runs ?? 0} />
        <Metric
          label="Pass"
          value={workflow.runs > 0 ? `${workflow.passRate}%` : '—'}
          tone={workflow.runs > 0 && workflow.passRate < 90 ? 'warning' : 'neon'}
        />
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-1.5">
        <Button size="sm" variant="primary" className="flex-1" onClick={() => navigate(`/workflows/${workflow.id}`)} loading={busy}>
          <Play size={14} /> Open
        </Button>
        <Tooltip label="Test in Flight Simulator">
          <Button size="iconSm" variant="outline" onClick={() => onTest?.(workflow)} aria-label="Test workflow">
            <FlaskConical size={15} />
          </Button>
        </Tooltip>
        <Tooltip label="Rename">
          <Button size="iconSm" variant="outline" onClick={() => setEditing(true)} aria-label="Rename workflow">
            <Pencil size={14} />
          </Button>
        </Tooltip>
        <Tooltip label={workflow.status === 'active' ? 'Re-publish' : 'Publish flow'}>
          <Button
            size="iconSm"
            variant={workflow.status === 'active' ? 'outline' : 'secondary'}
            onClick={() => onPublish?.(workflow)}
            aria-label="Publish workflow"
          >
            <Rocket size={14} />
          </Button>
        </Tooltip>
        <Tooltip label="Delete">
          <Button size="iconSm" variant="danger" onClick={() => onDelete?.(workflow)} aria-label="Delete workflow">
            <Trash2 size={14} />
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}

function Metric({ label, value, tone = 'neutral' }) {
  const tones = { neutral: 'text-ink', neon: 'text-neon', warning: 'text-warning' }
  return (
    <div>
      <p className={cn('text-sm font-semibold', tones[tone])}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-faint">{label}</p>
    </div>
  )
}
