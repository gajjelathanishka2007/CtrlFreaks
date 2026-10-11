import {
  FlaskConical,
  Activity,
  Clock,
  ArrowRight,
  AlertTriangle,
  Info,
  ShieldAlert,
  Mail,
  Bell,
  Table2,
} from 'lucide-react'
import { Badge, StatusPill } from '../ui/index.js'
import JsonBlock from '../common/JsonBlock.jsx'
import { cn } from '../../utils/cn.js'
import { formatDateTime, formatDuration } from '../../utils/format.js'

const STEP_DOT = {
  success: 'bg-success',
  warning: 'bg-warning',
  failed: 'bg-error',
  skipped: 'bg-faint',
  simulated: 'bg-electric',
}

const ACTION_ICON = { email: Mail, notification: Bell, sheets: Table2 }

export default function ExecutionDetail({ execution }) {
  if (!execution) return null
  const simulated = execution.mode === 'simulation'

  return (
    <div className="space-y-5">
      {/* Meta */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={execution.status} />
        <Badge tone={simulated ? 'violet' : 'blue'} dot>
          {simulated ? 'Simulation' : 'Production'}
        </Badge>
        <Badge tone="neutral">
          <Clock size={11} /> {formatDuration(execution.durationMs)}
        </Badge>
        <Badge tone="neutral">{execution.trigger}</Badge>
        <span className="ml-auto font-mono text-[11px] text-faint">{execution.id}</span>
      </div>

      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <Meta label="Workflow" value={execution.workflowName} />
        <Meta label="Triggered" value={formatDateTime(execution.startedAt)} />
      </div>

      {simulated && (
        <p className="flex items-start gap-2 rounded-xl border border-violet/30 bg-violet/8 p-3 text-xs text-violet">
          <FlaskConical size={14} className="mt-0.5 shrink-0" />
          This is a <span className="font-semibold">simulation run</span>. No emails were sent and no production data was
          modified.
        </p>
      )}

      {execution.failure && (
        <div className="rounded-xl border border-error/30 bg-error/8 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-error">
            <AlertTriangle size={15} /> Failed at {execution.failure.node}
          </p>
          <p className="mt-1 text-xs text-error/90">{execution.failure.reason}</p>
        </div>
      )}

      {/* Input */}
      <Section icon={ArrowRight} title="Input / form response">
        <JsonBlock value={execution.input} maxHeight="220px" />
      </Section>

      {/* Step logs */}
      <Section icon={Activity} title="Step-by-step execution log">
        <ol className="space-y-0">
          {(execution.logs || []).map((log, i, arr) => (
            <li key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                    STEP_DOT[log.status] || 'bg-faint',
                  )}
                />
                {i < arr.length - 1 && <span className="my-1 w-px flex-1 bg-edge-soft" />}
              </div>
              <div className="min-w-0 flex-1 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium text-ink">{log.node}</span>
                  <StatusPill status={log.status} showDot={false} />
                  {log.ms > 0 && <span className="text-[11px] text-faint">{log.ms} ms</span>}
                </div>
                {log.error && <p className="mt-1 text-xs text-error">{log.error}</p>}
                {log.note && <p className="mt-1 text-xs text-muted">{log.note}</p>}
                {log.output !== undefined && (
                  <JsonBlock value={log.output} className="mt-2" maxHeight="160px" />
                )}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* Simulated actions */}
      {execution.actions?.length > 0 && (
        <Section icon={Info} title="Simulated emails & notifications">
          <ul className="space-y-2">
            {execution.actions.map((a, i) => {
              const Icon = ACTION_ICON[a.type] || Info
              return (
                <li key={i} className="flex items-center gap-2.5 rounded-lg border border-edge-soft bg-base/40 p-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-electric/12 text-electric">
                    <Icon size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-ink">{a.detail}</p>
                    <p className="text-[11px] text-faint">{a.target}</p>
                  </div>
                  <Badge tone="violet" className="ml-auto">
                    Simulated
                  </Badge>
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      {/* Contract warnings */}
      {execution.contractWarnings?.length > 0 && (
        <Section icon={ShieldAlert} title="Data-contract warnings">
          <ul className="space-y-2">
            {execution.contractWarnings.map((w, i) => (
              <li
                key={i}
                className={cn(
                  'rounded-lg border p-3',
                  w.severity === 'error' ? 'border-error/30 bg-error/8' : 'border-warning/30 bg-warning/8',
                )}
              >
                <div className="flex items-center gap-2">
                  <Badge tone={w.severity === 'error' ? 'error' : 'warning'}>{w.severity}</Badge>
                  <span className="font-mono text-xs text-ink">{w.field}</span>
                  {w.actual && w.expected && (
                    <span className="text-[11px] text-faint">
                      expected <span className="font-mono">{w.expected}</span> · got{' '}
                      <span className="font-mono">{w.actual}</span>
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-muted">{w.message}</p>
                {w.suggestion && (
                  <p className="mt-1.5 text-[11px] text-neon">
                    Suggested mapping: <span className="font-mono">{w.suggestion.from}</span> →{' '}
                    <span className="font-mono">{w.suggestion.to}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

function Meta({ label, value }) {
  return (
    <div className="rounded-lg border border-edge-soft bg-base/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-0.5 truncate text-xs text-ink">{value}</p>
    </div>
  )
}

function Section({ icon: Icon, title, children }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-ink">
        <Icon size={14} className="text-faint" />
        {title}
      </h3>
      {children}
    </section>
  )
}
