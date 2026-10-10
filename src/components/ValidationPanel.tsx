import type { ValidationResult } from '../engine/types'
import { Icon } from './Icon'
import { cn } from '../lib/utils'

export function ValidationPanel({
  result,
  onSelectNode,
}: {
  result: ValidationResult
  onSelectNode: (nodeId: string) => void
}) {
  if (result.valid && result.warnings.length === 0) {
    return (
      <div className="m-3 flex items-start gap-2 rounded-lg border border-mint-500/30 bg-mint-500/10 p-3 text-xs text-mint-200">
        <Icon name="ShieldCheck" size={15} className="mt-0.5 shrink-0 text-mint-400" />
        <div>
          <p className="font-medium">Workflow is valid</p>
          <p className="mt-0.5 text-mint-300/80">It is ready to run. Press Run to execute it.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-4 text-[11px]">
        <span className="flex items-center gap-1.5 text-rose-300">
          <Icon name="AlertTriangle" size={13} /> {result.errors.length} error
          {result.errors.length === 1 ? '' : 's'}
        </span>
        <span className="flex items-center gap-1.5 text-amber-300">
          <Icon name="Info" size={13} /> {result.warnings.length} warning
          {result.warnings.length === 1 ? '' : 's'}
        </span>
      </div>

      {result.errors.map((issue, index) => (
        <IssueRow key={`e${index}`} tone="rose" issue={issue} onSelectNode={onSelectNode} />
      ))}
      {result.warnings.map((issue, index) => (
        <IssueRow key={`w${index}`} tone="amber" issue={issue} onSelectNode={onSelectNode} />
      ))}
    </div>
  )
}

function IssueRow({
  tone,
  issue,
  onSelectNode,
}: {
  tone: 'rose' | 'amber'
  issue: ValidationResult['errors'][number]
  onSelectNode: (nodeId: string) => void
}) {
  const clickable = Boolean(issue.nodeId)
  return (
    <button
      disabled={!clickable}
      onClick={() => issue.nodeId && onSelectNode(issue.nodeId)}
      className={cn(
        'flex w-full items-start gap-2 rounded-lg border p-2.5 text-left text-xs transition-colors',
        tone === 'rose'
          ? 'border-rose-500/30 bg-rose-500/10 text-rose-100'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-100',
        clickable && 'hover:brightness-125',
      )}
    >
      <Icon
        name={tone === 'rose' ? 'AlertTriangle' : 'Info'}
        size={14}
        className={cn('mt-0.5 shrink-0', tone === 'rose' ? 'text-rose-300' : 'text-amber-300')}
      />
      <span className="flex-1">
        {issue.message}
        {clickable && <span className="ml-1 text-[10px] opacity-70">(click to focus)</span>}
      </span>
      <span className="shrink-0 rounded bg-black/20 px-1.5 py-px text-[10px] opacity-70">{issue.code}</span>
    </button>
  )
}
