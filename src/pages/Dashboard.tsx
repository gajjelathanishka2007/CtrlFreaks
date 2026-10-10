import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore, defaultTriggerFor } from '../store/useStore'
import { Icon } from '../components/Icon'
import { Badge, Button, Card, EmptyState, Modal, SectionTitle, StatusBadge, TextArea } from '../components/ui'
import { cn, formatDuration, percent, timeAgo } from '../lib/utils'

export function Dashboard() {
  const navigate = useNavigate()
  const workflows = useStore((s) => s.workflows)
  const executions = useStore((s) => s.executions)
  const createFromPrompt = useStore((s) => s.createFromPrompt)
  const toggleWorkflowEnabled = useStore((s) => s.toggleWorkflowEnabled)
  const runWorkflowById = useStore((s) => s.runWorkflowById)
  const [promptOpen, setPromptOpen] = useState(false)
  const [prompt, setPrompt] = useState(
    'When a new lead arrives, validate their email, transform the data, and notify sales if the deal is over 100.',
  )
  const [busyId, setBusyId] = useState<string | null>(null)

  const stats = useMemo(() => {
    const finished = executions.filter((e) => e.status !== 'running')
    const succeeded = finished.filter((e) => e.status === 'success').length
    const failed = finished.filter((e) => e.status === 'failed').length
    return {
      totalWorkflows: workflows.length,
      activeWorkflows: workflows.filter((w) => w.enabled).length,
      totalExecutions: executions.length,
      succeeded,
      failed,
      successRate: percent(succeeded, succeeded + failed),
    }
  }, [workflows, executions])

  const recent = executions.slice(0, 6)
  const recentWorkflows = [...workflows].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6)

  const runNow = async (workflowId: string) => {
    setBusyId(workflowId)
    try {
      const workflow = workflows.find((w) => w.id === workflowId)
      await runWorkflowById(workflowId, workflow ? defaultTriggerFor(workflow) : {}, 'manual')
      navigate(`/executions`)
    } finally {
      setBusyId(null)
    }
  }

  const handleGenerate = () => {
    const workflow = createFromPrompt(prompt)
    setPromptOpen(false)
    navigate(`/builder/${workflow.id}`)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-400">
            Build, validate and run AI-powered automations. Everything below is derived from your live data.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setPromptOpen(true)}>
            <Icon name="Sparkles" size={16} className="text-grape-400" /> Generate with AI
          </Button>
          <Button variant="primary" onClick={() => navigate(`/builder/${useStore.getState().createWorkflow().id}`)}>
            <Icon name="Plus" size={16} /> New workflow
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Workflows" value={stats.totalWorkflows} icon="Workflow" tone="accent" />
        <StatCard label="Active" value={stats.activeWorkflows} icon="Activity" tone="mint" />
        <StatCard label="Executions" value={stats.totalExecutions} icon="History" tone="grape" />
        <StatCard
          label="Success rate"
          value={`${stats.successRate}%`}
          icon="Check"
          tone={stats.failed > 0 ? 'amber' : 'mint'}
          hint={`${stats.succeeded} ok · ${stats.failed} failed`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle
            title="Recent executions"
            description="The latest workflow runs"
            right={
              executions.length > 0 ? (
                <Link to="/executions" className="text-xs text-accent-400 hover:underline">
                  View all
                </Link>
              ) : undefined
            }
          />
          <div className="mt-3">
            {recent.length === 0 ? (
              <EmptyState
                icon="Rocket"
                title="No runs yet"
                description="Run a workflow to see execution results, logs and durations here."
              />
            ) : (
              <div className="divide-y divide-ink-700/60">
                {recent.map((execution) => (
                  <Link
                    key={execution.id}
                    to={`/executions/${execution.id}`}
                    className="flex items-center gap-3 py-2.5 transition-colors hover:bg-ink-800/40"
                  >
                    <StatusBadge status={execution.status} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{execution.workflowName}</p>
                      <p className="text-[11px] text-ink-400">
                        {timeAgo(execution.startedAt)} · {formatDuration(execution.durationMs)}
                      </p>
                    </div>
                    <Icon name="ChevronRight" size={15} className="text-ink-500" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle
            title="Your workflows"
            description="Recently updated"
            right={
              <Link to="/templates" className="text-xs text-accent-400 hover:underline">
                Templates
              </Link>
            }
          />
          <div className="mt-3">
            {recentWorkflows.length === 0 ? (
              <EmptyState
                icon="Workflow"
                title="Create your first workflow"
                description="Start from scratch, from a template, or generate one with AI."
                action={
                  <Button variant="primary" size="sm" onClick={() => navigate(`/builder/${useStore.getState().createWorkflow().id}`)}>
                    <Icon name="Plus" size={14} /> New workflow
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-ink-700/60">
                {recentWorkflows.map((workflow) => (
                  <div key={workflow.id} className="flex items-center gap-3 py-2.5">
                    <button
                      onClick={() => toggleWorkflowEnabled(workflow.id)}
                      title={workflow.enabled ? 'Disable workflow' : 'Enable workflow'}
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
                        workflow.enabled
                          ? 'border-mint-500/40 bg-mint-500/10 text-mint-400'
                          : 'border-ink-600 bg-ink-800 text-ink-400',
                      )}
                    >
                      <Icon name="Power" size={14} />
                    </button>
                    <Link to={`/builder/${workflow.id}`} className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{workflow.name}</p>
                      <p className="text-[11px] text-ink-400">
                        {workflow.nodes.length} nodes · {workflow.edges.length} connections · {timeAgo(workflow.updatedAt)}
                      </p>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => runNow(workflow.id)}
                      disabled={busyId === workflow.id}
                      title="Run with the trigger's sample payload"
                    >
                      <Icon name={busyId === workflow.id ? 'Loader2' : 'Play'} size={14} className={busyId === workflow.id ? 'animate-spin' : undefined} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Modal
        open={promptOpen}
        onClose={() => setPromptOpen(false)}
        title="Generate a workflow with AI"
        description="Describe the automation in plain English. The planner assembles a starter workflow you can refine."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPromptOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleGenerate}>
              <Icon name="Sparkles" size={15} /> Generate
            </Button>
          </>
        }
      >
        <TextArea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-[140px] font-sans text-sm" />
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2.5 text-[11px] text-amber-100">
          <Icon name="Info" size={13} className="mt-0.5 shrink-0 text-amber-300" />
          <span>
            This uses the built-in demo planner (keyword-based) so it works offline. The AI Transform node can use a live
            provider once you add a key in Settings.
          </span>
        </div>
      </Modal>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  tone,
  hint,
}: {
  label: string
  value: number | string
  icon: string
  tone: 'accent' | 'mint' | 'grape' | 'amber'
  hint?: string
}) {
  const tones: Record<string, string> = {
    accent: 'text-accent-400 bg-accent-500/15',
    mint: 'text-mint-400 bg-mint-500/15',
    grape: 'text-grape-400 bg-grape-500/15',
    amber: 'text-amber-300 bg-amber-500/15',
  }
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-400">{label}</p>
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', tones[tone])}>
          <Icon name={icon} size={15} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-ink-400">{hint}</p>}
    </Card>
  )
}
