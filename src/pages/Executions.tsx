import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { Icon } from '../components/Icon'
import { Button, Card, EmptyState, StatusBadge } from '../components/ui'
import { cn, formatDuration, timeAgo } from '../lib/utils'
import type { ExecutionStatus } from '../engine/types'

const FILTERS: { key: 'all' | ExecutionStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'success', label: 'Success' },
  { key: 'failed', label: 'Failed' },
  { key: 'cancelled', label: 'Cancelled' },
]

export function Executions() {
  const executions = useStore((s) => s.executions)
  const workflows = useStore((s) => s.workflows)
  const deleteExecution = useStore((s) => s.deleteExecution)
  const clearExecutions = useStore((s) => s.clearExecutions)

  const [filter, setFilter] = useState<'all' | ExecutionStatus>('all')
  const [workflowFilter, setWorkflowFilter] = useState('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return executions.filter((e) => {
      if (filter !== 'all' && e.status !== filter) return false
      if (workflowFilter !== 'all' && e.workflowId !== workflowFilter) return false
      if (q && !e.workflowName.toLowerCase().includes(q) && !e.id.toLowerCase().includes(q)) return false
      return true
    })
  }, [executions, filter, workflowFilter, query])

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-5 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Executions</h1>
          <p className="mt-1 text-sm text-ink-400">
            {executions.length} run{executions.length === 1 ? '' : 's'} recorded. Every run stores node-level results and logs.
          </p>
        </div>
        {executions.length > 0 && (
          <Button
            variant="ghost"
            className="text-rose-300 hover:bg-rose-500/10"
            onClick={() => {
              if (confirm('Delete all execution history? Workflows are not affected.')) clearExecutions()
            }}
          >
            <Icon name="Trash2" size={15} /> Clear history
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-ink-700 bg-ink-900/60 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                filter === f.key ? 'bg-accent-500/20 text-accent-300' : 'text-ink-400 hover:text-ink-200',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select
          value={workflowFilter}
          onChange={(e) => setWorkflowFilter(e.target.value)}
          className="rounded-lg border border-ink-600 bg-ink-900/80 px-2.5 py-2 text-xs text-white focus:outline-none"
        >
          <option value="all">All workflows</option>
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        <div className="relative ml-auto">
          <Icon name="Search" size={14} className="pointer-events-none absolute top-2.5 left-2.5 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search runs"
            className="w-48 rounded-lg border border-ink-600 bg-ink-900/80 py-2 pr-2 pl-8 text-xs text-white placeholder:text-ink-400/70 focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="History"
            title={executions.length === 0 ? 'No executions yet' : 'No runs match your filters'}
            description={
              executions.length === 0
                ? 'Open a workflow and press Run — the results will be listed here.'
                : 'Try clearing the filters above.'
            }
            action={
              executions.length === 0 ? (
                <Link to="/">
                  <Button variant="primary" size="sm">
                    <Icon name="LayoutDashboard" size={14} /> Go to dashboard
                  </Button>
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-ink-700/60 overflow-hidden">
          {filtered.map((execution) => (
            <div key={execution.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-800/40">
              <Link to={`/executions/${execution.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <StatusBadge status={execution.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{execution.workflowName}</p>
                  <p className="text-[11px] text-ink-400">
                    {timeAgo(execution.startedAt)} · {formatDuration(execution.durationMs)} ·{' '}
                    {execution.nodeResults.length} steps · {execution.source}
                  </p>
                </div>
                {execution.error && (
                  <span className="hidden max-w-[280px] truncate text-[11px] text-rose-300 lg:block">{execution.error}</span>
                )}
              </Link>
              <Link
                to={`/builder/${execution.workflowId}`}
                className="rounded-md p-1.5 text-ink-400 hover:bg-ink-700 hover:text-white"
                title="Open workflow"
              >
                <Icon name="Workflow" size={15} />
              </Link>
              <button
                onClick={() => deleteExecution(execution.id)}
                className="rounded-md p-1.5 text-ink-400 hover:bg-rose-500/10 hover:text-rose-300"
                title="Delete run"
              >
                <Icon name="Trash2" size={15} />
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
