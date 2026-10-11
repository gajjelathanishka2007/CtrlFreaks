import { useState } from 'react'
import {
  ShieldAlert,
  ArrowRight,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  Wand2,
  Type,
  Hash,
  CircleAlert,
} from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import { Button, Badge } from '../ui/index.js'
import { demoContractIssues } from '../../data/mock.js'
import { cn } from '../../utils/cn.js'

const TYPE_ICON = { string: Type, number: Hash }

export default function DiagnosticsDrawer({ open, onClose, onApplyMapping, onToast }) {
  const [state, setState] = useState({}) // id -> { tested, applied }

  const setIssueState = (id, patch) => setState((s) => ({ ...s, [id]: { ...s[id], ...patch } }))

  const testRepair = (issue) => {
    setIssueState(issue.id, { tested: 'running' })
    setTimeout(() => {
      setIssueState(issue.id, { tested: 'success' })
      onToast?.({
        type: 'success',
        title: 'Repair test passed',
        message: `Mapping ${issue.suggestion.from} → ${issue.suggestion.to} produces the expected field.`,
      })
    }, 650)
  }

  const apply = (issue) => {
    onApplyMapping?.(issue)
    setIssueState(issue.id, { applied: true })
  }

  const unresolved = demoContractIssues.filter((i) => !state[i.id]?.applied).length

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Data-contract diagnostics"
      description="Compare expected inputs with actual upstream outputs. Repairs are tested before they are applied — the saved workflow is never modified silently."
      footer={
        <div className="flex w-full items-center justify-between">
          <p className="text-[11px] text-faint">
            {unresolved} unresolved · {demoContractIssues.length} total
          </p>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {demoContractIssues.map((issue) => {
          const s = state[issue.id] || {}
          return (
            <div
              key={issue.id}
              className={cn(
                'rounded-xl border p-3.5',
                issue.severity === 'error' ? 'border-error/30 bg-error/6' : 'border-warning/30 bg-warning/6',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={issue.severity === 'error' ? 'error' : 'warning'} dot>
                  {issue.severity}
                </Badge>
                <span className="text-[12.5px] font-semibold text-ink">{issue.step}</span>
                {s.applied && (
                  <Badge tone="success" className="ml-auto">
                    <CheckCircle2 size={11} /> Applied
                  </Badge>
                )}
              </div>

              <p className="mt-2 text-[12px] leading-relaxed text-muted">{issue.message}</p>

              {/* Fields comparison */}
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <FieldCard title="Expected" field={issue.expected} tone="neon" required />
                <FieldCard title="Actual" field={issue.actual} tone="warning" />
              </div>

              {issue.suggestion && (
                <div className="mt-2.5 rounded-lg border border-edge-soft bg-base/50 p-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] text-muted">
                    <ArrowRight size={11} className="text-neon" /> Suggested mapping:{' '}
                    <span className="font-mono text-neon">{issue.suggestion.from}</span> →{' '}
                    <span className="font-mono text-neon">{issue.suggestion.to}</span>
                    {issue.suggestion.cast && (
                      <span className="text-faint">· cast to {issue.suggestion.cast}</span>
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => testRepair(issue)}
                      loading={s.tested === 'running'}
                      disabled={s.tested === 'success' || s.applied}
                    >
                      <FlaskConical size={12} /> Test Repair
                    </Button>
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={() => apply(issue)}
                      disabled={s.tested !== 'success' || s.applied}
                    >
                      <Wand2 size={12} /> Apply Mapping
                    </Button>
                    <span className="text-[10.5px] text-faint">
                      {s.applied
                        ? 'Mapping added to the canvas — review and save.'
                        : s.tested === 'success'
                          ? 'Test passed. You may apply the mapping.'
                          : 'Test the mapping before applying it.'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

function FieldCard({ title, field, tone, required }) {
  const Icon = TYPE_ICON[field.type] || CircleAlert
  return (
    <div className={cn('rounded-lg border bg-base/40 p-2.5', tone === 'neon' ? 'border-neon/25' : 'border-warning/25')}>
      <p className="text-[10px] uppercase tracking-wide text-faint">{title}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <span className={cn('font-mono text-[12px]', tone === 'neon' ? 'text-neon' : 'text-warning')}>{field.name}</span>
        {field.required && <span className="text-[10px] text-error">required</span>}
      </div>
      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
        <Icon size={11} /> {field.type}
        {!field.required && <span className="text-faint">· optional</span>}
      </p>
    </div>
  )
}
