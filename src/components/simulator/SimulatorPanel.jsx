import { useEffect, useMemo, useState } from 'react'
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CircleDashed,
  ArrowRight,
  Mail,
  Bell,
  Table2,
  Info,
  MinusCircle,
} from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import { Button, Badge, StatusPill, Spinner, EmptyState } from '../ui/index.js'
import { getScenarios, runSimulation } from '../../services/simulationService.js'
import { cn } from '../../utils/cn.js'
import { formatDuration } from '../../utils/format.js'

const EXPECT_TONE = { pass: 'success', fail: 'error', warn: 'warning' }
const STEP_COLOR = {
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  failed: 'bg-error/15 text-error',
  skipped: 'bg-elevated text-faint',
}
const ACTION_ICON = { email: Mail, notification: Bell, sheets: Table2 }

export default function SimulatorPanel({ open, onClose, workflow }) {
  const [scenarios, setScenarios] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    getScenarios().then(({ data }) => {
      setScenarios(data || [])
      setSelected(new Set((data || []).map((s) => s.id)))
      setResult(null)
      setActiveId(null)
      setError(null)
    }).catch((err) => {
      setScenarios([])
      setError(err?.message || 'Scenarios could not be loaded. Please try again.')
    })
  }, [open])

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const run = async () => {
    setRunning(true)
    setError(null)
    try {
      const { data } = await runSimulation(workflow, [...selected])
      setResult(data)
      setActiveId(data?.results?.[0]?.scenarioId || null)
    } catch (err) {
      setResult(null)
      setError(err?.message || 'The simulation could not be completed. Please try again.')
    } finally {
      setRunning(false)
    }
  }

  const activeResult = useMemo(
    () => result?.results?.find((r) => r.scenarioId === activeId) || null,
    [result, activeId],
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Flight Simulator"
      description="Test this workflow against scenarios before publishing. Simulations never send real emails or change production data."
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-[11px] text-faint">
            {selected.size} of {scenarios.length} scenarios selected
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" size="sm" onClick={run} loading={running} disabled={selected.size === 0}>
              <Play size={14} /> Run Simulation
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
        {/* Scenario list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-faint">Scenarios</h3>
            <div className="flex gap-1">
              <button
                onClick={() => setSelected(new Set(scenarios.map((s) => s.id)))}
                className="text-[11px] text-muted hover:text-neon"
              >
                All
              </button>
              <span className="text-faint">·</span>
              <button onClick={() => setSelected(new Set())} className="text-[11px] text-muted hover:text-neon">
                None
              </button>
            </div>
          </div>
          <ul className="space-y-1.5">
            {scenarios.map((s) => {
              const isSel = selected.has(s.id)
              const res = result?.results?.find((r) => r.scenarioId === s.id)
              return (
                <li key={s.id}>
                  <button
                    onClick={() => {
                      toggle(s.id)
                      if (res) setActiveId(s.id)
                    }}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition',
                      isSel ? 'border-neon/40 bg-neon/5' : 'border-edge bg-card hover:border-[#3b424d]',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
                        isSel ? 'border-neon bg-neon text-[#04140D]' : 'border-edge',
                      )}
                    >
                      {isSel && <CheckCircle2 size={11} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[12.5px] font-medium text-ink">{s.name}</p>
                        <Badge tone={EXPECT_TONE[s.expectation]} className="!text-[9px]">
                          {s.expectation}
                        </Badge>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-faint">{s.description}</p>
                      {res && (
                        <div className="mt-1 flex items-center gap-1">
                          <StatusPill status={res.status} showDot={false} />
                          {!res.asExpected && <span className="text-[10px] text-warning">unexpected</span>}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {error && !running && (
            <div className="rounded-2xl border border-error/30 bg-error/8 p-4">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-error">
                <XCircle size={15} /> Simulation failed
              </p>
              <p className="mt-1 text-[12px] text-error/90">{error}</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={run} disabled={selected.size === 0}>
                <Play size={14} /> Try again
              </Button>
            </div>
          )}

          {!result && !running && !error && (
            <div className="rounded-2xl border border-edge bg-card">
              <EmptyState
                icon={FlaskConical}
                title="Ready to simulate"
                description="Select scenarios and run the simulation to see a deterministic, step-by-step trace. No real actions are performed."
              />
            </div>
          )}

          {running && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-edge bg-card py-16 text-muted">
              <Spinner size={22} />
              <p className="text-sm">Running {selected.size} scenarios…</p>
            </div>
          )}

          {result && !running && (
            <>
              <Summary result={result} />
              {activeResult && <ResultDetail result={activeResult} />}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

function Summary({ result }) {
  const { summary } = result
  const cells = [
    { label: 'Passed', value: summary.passed, tone: 'text-success', icon: CheckCircle2 },
    { label: 'Warnings', value: summary.warned, tone: 'text-warning', icon: AlertTriangle },
    { label: 'Failed', value: summary.failed, tone: 'text-error', icon: XCircle },
    { label: 'As expected', value: `${summary.asExpected}/${summary.total}`, tone: 'text-ink', icon: CircleDashed },
  ]
  return (
    <div className="rounded-2xl border border-edge bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">Test summary</h3>
        <Badge tone="violet" dot>
          Deterministic simulation
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label} className="rounded-xl border border-edge-soft bg-base/40 p-2.5">
            <c.icon size={14} className={c.tone} />
            <p className={cn('mt-1.5 text-lg font-semibold', c.tone)}>{c.value}</p>
            <p className="text-[10px] uppercase tracking-wide text-faint">{c.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-elevated">
        <div className="h-full rounded-full bg-neon transition-all" style={{ width: `${summary.passRate}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] text-faint">{summary.passRate}% of scenarios passed</p>
    </div>
  )
}

function ResultDetail({ result }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">{result.name}</h3>
        <StatusPill status={result.status} />
        <Badge tone={result.asExpected ? 'success' : 'warning'}>
          {result.asExpected ? 'As expected' : 'Unexpected result'}
        </Badge>
        <span className="ml-auto text-[11px] text-faint">{formatDuration(result.durationMs)}</span>
      </div>

      {/* Execution path */}
      <div>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">Execution path</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {result.steps.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className={cn('rounded-lg px-2 py-1 text-[11px] font-medium', STEP_COLOR[s.status] || 'bg-elevated text-muted')}>
                {s.nodeName}
              </span>
              {i < result.steps.length - 1 && <ArrowRight size={11} className="text-faint" />}
            </div>
          ))}
        </div>
      </div>

      {/* Failure */}
      {result.failure && (
        <div className="rounded-xl border border-error/30 bg-error/8 p-3">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-error">
            <XCircle size={14} /> Failed at {result.failure.node}
          </p>
          <p className="mt-1 text-[12px] text-error/90">{result.failure.reason}</p>
          {result.failure.hint && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
              <Info size={11} /> {result.failure.hint}
            </p>
          )}
        </div>
      )}

      {/* Steps */}
      <div>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">Step-by-step trace</p>
        <ol className="space-y-0">
          {result.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full',
                  s.status === 'success' ? 'bg-success' :
                  s.status === 'warning' ? 'bg-warning' :
                  s.status === 'failed' ? 'bg-error' : 'bg-faint')} />
                {i < result.steps.length - 1 && <span className="my-1 w-px flex-1 bg-edge-soft" />}
              </div>
              <div className="min-w-0 flex-1 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] font-medium text-ink">{s.nodeName}</span>
                  <StatusPill status={s.status} showDot={false} />
                  {s.ms > 0 && <span className="text-[10px] text-faint">{s.ms} ms</span>}
                </div>
                {s.note && <p className="mt-0.5 text-[11px] text-muted">{s.note}</p>}
                {s.error && <p className="mt-0.5 text-[11px] text-error">{s.error}</p>}
                {s.output !== undefined && s.status !== 'skipped' && (
                  <pre className="mt-1 overflow-x-auto rounded-lg border border-edge-soft bg-base/60 p-2 font-mono text-[10.5px] text-muted synq-scroll">
                    {JSON.stringify(s.output)}
                  </pre>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Data changes */}
      {result.dataChanges.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">Data changes</p>
          <ul className="space-y-1">
            {result.dataChanges.map((d, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg border border-edge-soft bg-base/40 px-2.5 py-1.5 text-[11px]">
                <span className="font-mono text-neon">{d.field}</span>
                <ArrowRight size={11} className="text-faint" />
                <span className="font-mono text-muted">{JSON.stringify(d.to)}</span>
                {d.via && <span className="ml-auto text-faint">{d.via}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Simulated actions */}
      {result.actions.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">Simulated actions</p>
          <ul className="space-y-1.5">
            {result.actions.map((a, i) => {
              const Icon = ACTION_ICON[a.type] || Info
              return (
                <li key={i} className="flex items-center gap-2.5 rounded-lg border border-electric/25 bg-electric/8 p-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-electric/15 text-electric">
                    <Icon size={13} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11.5px] text-ink">{a.detail}</p>
                    <p className="text-[10px] text-faint">{a.target}</p>
                  </div>
                  <Badge tone="violet" className="ml-auto">
                    Simulated
                  </Badge>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Contract warnings */}
      {result.contractWarnings.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">Contract warnings</p>
          <ul className="space-y-1.5">
            {result.contractWarnings.map((w, i) => (
              <li key={i} className="rounded-lg border border-warning/30 bg-warning/8 p-2.5">
                <p className="text-[11px] text-muted">
                  <span className="font-mono text-warning">{w.field}</span> — {w.message}
                </p>
                {w.suggestion && (
                  <p className="mt-1 text-[10.5px] text-neon">
                    Suggested: <span className="font-mono">{w.suggestion.from}</span> →{' '}
                    <span className="font-mono">{w.suggestion.to}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.steps.every((s) => s.status !== 'skipped' || s.nodeType) && result.steps.some((s) => s.note?.includes('execution service')) && (
        <p className="flex items-start gap-1.5 rounded-lg border border-violet/25 bg-violet/8 p-2.5 text-[11px] text-violet">
          <MinusCircle size={12} className="mt-0.5 shrink-0" />
          Code steps were not executed — no execution service is connected. Their behaviour is skipped in this simulation.
        </p>
      )}
    </div>
  )
}
