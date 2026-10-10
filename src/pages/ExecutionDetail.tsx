import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { Icon } from '../components/Icon'
import { Badge, Button, Card, EmptyState, StatusBadge } from '../components/ui'
import { cn, formatDateTime, formatDuration, pretty } from '../lib/utils'

const LOG_COLOR: Record<string, string> = {
  info: 'text-accent-400',
  success: 'text-mint-400',
  warn: 'text-amber-300',
  error: 'text-rose-300',
}

export function ExecutionDetail() {
  const { executionId } = useParams()
  const navigate = useNavigate()
  const executions = useStore((s) => s.executions)
  const runWorkflowById = useStore((s) => s.runWorkflowById)
  const [rerunning, setRerunning] = useState(false)

  const execution = executions.find((e) => e.id === executionId)

  if (!execution) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="max-w-md">
          <EmptyState
            icon="History"
            title="Execution not found"
            description="It may have been deleted when its workflow was removed."
            action={
              <Button variant="primary" onClick={() => navigate('/executions')}>
                Back to executions
              </Button>
            }
          />
        </Card>
      </div>
    )
  }

  const ok = execution.nodeResults.filter((r) => r.status === 'success').length
  const failed = execution.nodeResults.filter((r) => r.status === 'failed').length
  const skipped = execution.nodeResults.filter((r) => r.status === 'skipped').length
  const results = [...execution.nodeResults].sort((a, b) => a.startedAt - b.startedAt)

  const rerun = async () => {
    setRerunning(true)
    try {
      const next = await runWorkflowById(execution.workflowId, execution.trigger, 'manual')
      if (next) navigate(`/executions/${next.id}`)
    } finally {
      setRerunning(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-5 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/executions" className="mb-1 flex items-center gap-1 text-xs text-ink-400 hover:text-white">
            <Icon name="ArrowLeft" size={13} /> Executions
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
            {execution.workflowName}
            <StatusBadge status={execution.status} />
          </h1>
          <p className="mt-1 text-xs text-ink-400">
            {formatDateTime(execution.startedAt)} · {formatDuration(execution.durationMs)} · {execution.source} ·{' '}
            <span className="font-mono">{execution.id}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/builder/${execution.workflowId}`}>
            <Button variant="secondary">
              <Icon name="Workflow" size={15} /> Open workflow
            </Button>
          </Link>
          <Button variant="primary" onClick={rerun} disabled={rerunning}>
            <Icon name={rerunning ? 'Loader2' : 'RefreshCw'} size={15} className={rerunning ? 'animate-spin' : undefined} />
            Run again
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Steps" value={execution.nodeResults.length} />
        <MiniStat label="Succeeded" value={ok} tone="mint" />
        <MiniStat label="Failed" value={failed} tone="rose" />
        <MiniStat label="Skipped" value={skipped} />
      </div>

      {execution.error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
          <Icon name="AlertTriangle" size={16} className="mt-0.5 shrink-0 text-rose-300" />
          <div>
            <p className="font-medium">Execution failed</p>
            <p className="mt-0.5 text-xs text-rose-200/90">{execution.error}</p>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Node-by-node results</h2>
          <div className="space-y-2">
            {results.map((result, index) => (
              <NodeCard key={result.nodeId} result={result} index={index} defaultOpen={result.status === 'failed'} />
            ))}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-white">
              <Icon name="Code2" size={15} className="text-accent-400" /> Trigger payload
            </h2>
            <pre className="max-h-64 overflow-auto rounded-lg border border-ink-700 bg-ink-950/70 p-2.5 text-[11px] text-ink-200">
              {pretty(execution.trigger)}
            </pre>
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-white">
              <Icon name="Terminal" size={15} className="text-accent-400" /> Logs
            </h2>
            <div className="max-h-80 space-y-1 overflow-auto font-mono text-[11px]">
              {execution.logs.length === 0 && <p className="text-ink-400">No logs.</p>}
              {execution.logs.map((log, index) => (
                <div key={index} className="flex gap-2 rounded px-1.5 py-1 hover:bg-ink-800/60">
                  <span className="shrink-0 text-ink-500">{new Date(log.ts).toLocaleTimeString()}</span>
                  <span className={cn('shrink-0 uppercase', LOG_COLOR[log.level])}>{log.level}</span>
                  <span className="text-ink-200">
                    {log.nodeName ? `[${log.nodeName}] ` : ''}
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {Object.keys(execution.saved).length > 0 && (
            <Card className="p-4">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-white">
                <Icon name="Save" size={15} className="text-accent-400" /> Saved values
              </h2>
              {Object.entries(execution.saved).map(([key, value]) => (
                <pre
                  key={key}
                  className="mb-1.5 overflow-auto rounded-lg border border-ink-700 bg-ink-950/70 p-2.5 text-[11px] text-ink-200"
                >
                  {key}: {pretty(value, 800)}
                </pre>
              ))}
            </Card>
          )}

          <Card className="p-4">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-white">
              <Icon name="Bell" size={15} className="text-accent-400" /> Notifications
              <Badge tone="neutral">{execution.notifications.length}</Badge>
            </h2>
            {execution.notifications.length === 0 ? (
              <p className="text-xs text-ink-400">No notifications were sent.</p>
            ) : (
              <div className="space-y-2">
                {execution.notifications.map((n, index) => (
                  <div key={index} className="rounded-lg border border-ink-700 bg-ink-950/70 p-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge tone={n.transport === 'demo' ? 'amber' : 'mint'}>{n.transport}</Badge>
                      <span className="text-ink-300">{n.channel}</span>
                      <span className="text-ink-400">→ {n.to}</span>
                    </div>
                    <p className="mt-1 font-medium text-ink-200">{n.subject}</p>
                    <p className="text-ink-400">{n.body}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: 'mint' | 'rose' }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] text-ink-400">{label}</p>
      <p className={cn('mt-1 text-xl font-bold', tone === 'mint' ? 'text-mint-400' : tone === 'rose' ? 'text-rose-300' : 'text-white')}>
        {value}
      </p>
    </Card>
  )
}

function NodeCard({
  result,
  index,
  defaultOpen,
}: {
  result: ReturnType<typeof useStore.getState>['executions'][number]['nodeResults'][number]
  index: number
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen))
  const statusColor: Record<string, string> = {
    success: 'text-mint-400',
    failed: 'text-rose-300',
    skipped: 'text-ink-500',
    running: 'text-accent-400',
    pending: 'text-ink-400',
    cancelled: 'text-amber-300',
  }
  const statusIcon: Record<string, string> = {
    success: 'Check',
    failed: 'AlertTriangle',
    skipped: 'CircleDot',
    running: 'Loader2',
    pending: 'Clock',
    cancelled: 'X',
  }

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/50">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-xs font-semibold text-ink-300">
          {index + 1}
        </span>
        <Icon
          name={statusIcon[result.status] ?? 'CircleDot'}
          size={15}
          className={cn(statusColor[result.status], result.status === 'running' && 'animate-spin')}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">{result.nodeName}</span>
          {result.skippedReason && <span className="block text-[11px] text-ink-400">{result.skippedReason}</span>}
        </span>
        {result.branch && result.branch !== 'out' && <Badge tone="accent">{result.branch}</Badge>}
        <span className="shrink-0 text-[11px] text-ink-400">{formatDuration(result.durationMs)}</span>
        <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={15} className="shrink-0 text-ink-400" />
      </button>

      {open && (result.input !== undefined || result.output !== undefined || result.error) && (
        <div className="space-y-2 border-t border-ink-700/70 px-3 py-3">
          {result.error && (
            <p className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-200">
              {result.error}
            </p>
          )}
          {result.input !== undefined && (
            <div>
              <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-ink-400 uppercase">Input</p>
              <pre className="max-h-52 overflow-auto rounded border border-ink-700 bg-ink-950/70 p-2 text-[11px] text-ink-200">
                {pretty(result.input)}
              </pre>
            </div>
          )}
          {result.output !== undefined && (
            <div>
              <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-ink-400 uppercase">Output</p>
              <pre className="max-h-52 overflow-auto rounded border border-ink-700 bg-ink-950/70 p-2 text-[11px] text-ink-200">
                {pretty(result.output)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
