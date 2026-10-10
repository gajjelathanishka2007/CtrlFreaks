import { useState } from 'react'
import type { Execution, NodeExecutionResult } from '../engine/types'
import { cn, formatDateTime, formatDuration, pretty } from '../lib/utils'
import { Icon } from './Icon'
import { Badge, EmptyState, StatusBadge } from './ui'

export function ExecutionPanel({
  execution,
  selectedNodeId,
  onSelectNode,
}: {
  execution: Execution | null
  selectedNodeId: string | null
  onSelectNode: (nodeId: string) => void
}) {
  const [tab, setTab] = useState<'nodes' | 'logs' | 'data'>('nodes')

  if (!execution) {
    return (
      <EmptyState
        icon="Rocket"
        title="No run yet"
        description="Press Run to execute this workflow. Node-by-node results, logs and saved values will appear here."
      />
    )
  }

  const results = [...execution.nodeResults].sort((a, b) => a.startedAt - b.startedAt)
  const savedKeys = Object.keys(execution.saved ?? {})

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink-700/80 p-3">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={execution.status} />
          <span className="text-[11px] text-ink-400">{formatDuration(execution.durationMs)}</span>
        </div>
        <p className="mt-1.5 text-[11px] text-ink-400">
          {formatDateTime(execution.startedAt)} · {results.filter((r) => r.status === 'success').length} ok ·{' '}
          {results.filter((r) => r.status === 'failed').length} failed ·{' '}
          {results.filter((r) => r.status === 'skipped').length} skipped
        </p>
        {execution.error && (
          <p className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-200">
            {execution.error}
          </p>
        )}
      </div>

      <div className="flex gap-1 border-b border-ink-700/80 px-2 pt-2">
        {(
          [
            ['nodes', 'Nodes'],
            ['logs', `Logs${execution.logs.length ? ` (${execution.logs.length})` : ''}`],
            ['data', 'Output'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors',
              tab === key ? 'bg-ink-800 text-white' : 'text-ink-400 hover:text-ink-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'nodes' && (
          <div className="space-y-1.5">
            {results.map((result) => (
              <NodeResultRow
                key={result.nodeId}
                result={result}
                selected={selectedNodeId === result.nodeId}
                onSelect={() => onSelectNode(result.nodeId)}
              />
            ))}
          </div>
        )}

        {tab === 'logs' && (
          <div className="space-y-1 font-mono text-[11px]">
            {execution.logs.length === 0 && <p className="text-ink-400">No logs.</p>}
            {execution.logs.map((log, index) => (
              <div key={index} className="flex gap-2 rounded px-1.5 py-1 hover:bg-ink-800/60">
                <span className="shrink-0 text-ink-500">{new Date(log.ts).toLocaleTimeString()}</span>
                <span className={cn('shrink-0 uppercase', LOG_COLOR[log.level])}>{log.level}</span>
                <span className="text-ink-200">{log.nodeName ? `[${log.nodeName}] ` : ''}{log.message}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'data' && (
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-[11px] font-semibold text-ink-300">Trigger payload</p>
              <pre className="overflow-x-auto rounded-lg border border-ink-700 bg-ink-950/70 p-2.5 text-[11px] text-ink-200">
                {pretty(execution.trigger)}
              </pre>
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-ink-300">
                <Icon name="Save" size={12} /> Saved values
              </p>
              {savedKeys.length === 0 ? (
                <p className="text-[11px] text-ink-400">No values were saved by this run.</p>
              ) : (
                savedKeys.map((key) => (
                  <pre
                    key={key}
                    className="mb-1.5 overflow-x-auto rounded-lg border border-ink-700 bg-ink-950/70 p-2.5 text-[11px] text-ink-200"
                  >
                    {key}: {pretty(execution.saved[key], 1200)}
                  </pre>
                ))
              )}
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-ink-300">
                <Icon name="Bell" size={12} /> Notifications ({execution.notifications.length})
              </p>
              {execution.notifications.length === 0 ? (
                <p className="text-[11px] text-ink-400">No notifications were sent.</p>
              ) : (
                execution.notifications.map((n, index) => (
                  <div key={index} className="mb-1.5 rounded-lg border border-ink-700 bg-ink-950/70 p-2.5 text-[11px]">
                    <div className="flex items-center gap-2">
                      <Badge tone={n.transport === 'demo' ? 'amber' : 'mint'}>{n.transport}</Badge>
                      <span className="text-ink-300">{n.channel}</span>
                      <span className="text-ink-400">→ {n.to}</span>
                    </div>
                    <p className="mt-1 font-medium text-ink-200">{n.subject}</p>
                    <p className="text-ink-400">{n.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const LOG_COLOR: Record<string, string> = {
  info: 'text-accent-400',
  success: 'text-mint-400',
  warn: 'text-amber-300',
  error: 'text-rose-300',
}

function NodeResultRow({
  result,
  selected,
  onSelect,
}: {
  result: NodeExecutionResult
  selected: boolean
  onSelect: () => void
}) {
  const [open, setOpen] = useState(false)
  const statusIcon: Record<string, string> = {
    success: 'Check',
    failed: 'AlertTriangle',
    skipped: 'CircleDot',
    running: 'Loader2',
    pending: 'Clock',
    cancelled: 'X',
  }
  const statusColor: Record<string, string> = {
    success: 'text-mint-400',
    failed: 'text-rose-300',
    skipped: 'text-ink-500',
    running: 'text-accent-400',
    pending: 'text-ink-400',
    cancelled: 'text-amber-300',
  }

  return (
    <div className={cn('rounded-lg border transition-colors', selected ? 'border-accent-500/60 bg-accent-500/5' : 'border-ink-700 bg-ink-900/50')}>
      <button onClick={onSelect} className="flex w-full items-center gap-2 px-2.5 py-2 text-left">
        <Icon
          name={statusIcon[result.status] ?? 'CircleDot'}
          size={14}
          className={cn(statusColor[result.status], result.status === 'running' && 'animate-spin')}
        />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-white">{result.nodeName}</span>
        <span className="shrink-0 text-[11px] text-ink-400">{formatDuration(result.durationMs)}</span>
        <button
          onClick={(event) => {
            event.stopPropagation()
            setOpen((o) => !o)
          }}
          className="rounded p-0.5 text-ink-400 hover:text-white"
          aria-label="Toggle details"
        >
          <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={14} />
        </button>
      </button>

      {result.skippedReason && !open && (
        <p className="px-2.5 pb-2 pl-8 text-[11px] text-ink-400">{result.skippedReason}</p>
      )}

      {open && (
        <div className="space-y-2 border-t border-ink-700/70 px-2.5 py-2">
          {result.branch && result.branch !== 'out' && (
            <p className="text-[11px] text-ink-300">
              branch: <span className="text-accent-400">{result.branch}</span>
            </p>
          )}
          {result.error && (
            <p className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200">
              {result.error}
            </p>
          )}
          <Detail label="Input" value={result.input} />
          {result.output !== undefined && <Detail label="Output" value={result.output} />}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-ink-400 uppercase">{label}</p>
      <pre className="max-h-48 overflow-auto rounded border border-ink-700 bg-ink-950/70 p-2 text-[11px] text-ink-200">
        {pretty(value)}
      </pre>
    </div>
  )
}
