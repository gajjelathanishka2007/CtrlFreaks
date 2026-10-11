import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Workflow as WorkflowIcon,
  Activity,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Plus,
  FlaskConical,
  ArrowRight,
  Clock,
  Zap,
} from 'lucide-react'
import PageHeader, { PageBody } from '../components/layout/PageHeader.jsx'
import { SectionCard } from '../components/common/SectionCard.jsx'
import StatCard from '../components/common/StatCard.jsx'
import DemoBanner from '../components/common/DemoBanner.jsx'
import { Button, StatusPill, Spinner, EmptyState } from '../components/ui/index.js'
import { getDashboard } from '../services/executionService.js'
import { useWorkflows } from '../context/WorkflowsContext.jsx'
import { formatRelative } from '../utils/format.js'
import { cn } from '../utils/cn.js'

const ACTIVITY_TONE = {
  execution: 'text-neon',
  warning: 'text-warning',
  failure: 'text-error',
  publish: 'text-electric',
}

export default function Dashboard() {
  const { workflows, loading: wfLoading, create } = useWorkflows()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let alive = true
    getDashboard()
      .then(({ data }) => {
        if (alive) setData(data)
      })
      .catch(() => {
        if (alive) setData(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const createWorkflow = async () => {
    setCreating(true)
    try {
      const { workflow } = await create({ name: 'Untitled Workflow' })
      navigate(`/workflows/${workflow.id}`)
    } catch {
      // The context surfaces load errors; keep the button usable on failure.
    } finally {
      setCreating(false)
    }
  }

  const stats = [
    { label: 'Total workflows', value: data?.stats?.totalWorkflows ?? workflows.length, icon: WorkflowIcon, tone: 'blue' },
    { label: 'Active workflows', value: data?.stats?.activeWorkflows ?? 0, icon: Zap, tone: 'neon' },
    { label: 'Simulation pass rate', value: `${data?.stats?.simulationPassRate ?? 0}%`, icon: FlaskConical, tone: 'violet', hint: 'Across recent runs' },
    { label: 'Failed executions', value: data?.stats?.failedExecutions ?? 0, icon: XCircle, tone: 'error', hint: 'Last 24 hours' },
    { label: 'Data-contract warnings', value: data?.stats?.contractWarnings ?? 0, icon: ShieldAlert, tone: 'warning', hint: 'Needs review' },
  ]

  const recentWorkflows = workflows.slice(0, 5)

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        className="border-b border-edge bg-sidebar/40 px-4 py-4 sm:px-6 lg:px-8"
        title="Dashboard"
        subtitle="Build. Simulate. Improve. — an overview of your automation workspace."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/workflows')}
            >
              <FlaskConical size={15} /> Test Workflow
            </Button>
            <Button variant="primary" size="sm" onClick={createWorkflow} loading={creating}>
              <Plus size={15} /> Create Workflow
            </Button>
          </>
        }
      />

      <PageBody className="space-y-5">
        <DemoBanner />

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* Recent workflows */}
          <SectionCard
            className="xl:col-span-2"
            title="Recent workflows"
            description="Jump back into your latest automations"
            icon={WorkflowIcon}
            actions={
              <Link to="/workflows">
                <Button size="xs" variant="ghost">
                  View all <ArrowRight size={13} />
                </Button>
              </Link>
            }
          >
            {wfLoading ? (
              <div className="flex items-center gap-2 py-8 text-muted">
                <Spinner size={16} /> Loading workflows…
              </div>
            ) : recentWorkflows.length === 0 ? (
              <EmptyState
                icon={WorkflowIcon}
                title="No workflows yet"
                description="Create your first workflow to get started."
                action={
                  <Button size="sm" variant="primary" onClick={createWorkflow}>
                    <Plus size={14} /> Create Workflow
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-edge-soft">
                {recentWorkflows.map((w) => (
                  <li key={w.id}>
                    <Link
                      to={`/workflows/${w.id}`}
                      className="group flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-edge bg-elevated text-muted transition group-hover:border-neon/40 group-hover:text-neon">
                          <WorkflowIcon size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{w.name}</p>
                          <p className="truncate text-xs text-faint">
                            {w.nodes ?? 0} nodes · updated {formatRelative(w.updatedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {w.runs > 0 && (
                          <span className="hidden text-xs text-faint sm:inline">
                            {w.passRate}% pass
                          </span>
                        )}
                        <StatusPill status={w.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Activity */}
          <SectionCard title="Recent activity" description="Workspace events" icon={Activity}>
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-muted">
                <Spinner size={16} /> Loading activity…
              </div>
            ) : (
              <ol className="relative space-y-3.5">
                {(data?.activity || []).map((a, i, arr) => (
                  <li key={a.id} className="relative flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full bg-current', ACTIVITY_TONE[a.type])} />
                      {i < arr.length - 1 && <span className="mt-1 w-px flex-1 bg-edge-soft" />}
                    </div>
                    <div className="min-w-0 pb-1">
                      <p className="text-[13px] leading-snug text-ink">{a.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-faint">
                        <Clock size={10} /> {formatRelative(a.at)} · {a.meta}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </div>

        {/* Quick actions */}
        <SectionCard title="Quick actions" icon={Zap}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <QuickAction
              to="/workflows"
              icon={WorkflowIcon}
              title="Browse workflows"
              desc="Open the editor and manage your flows"
            />
            <QuickAction
              to="/workflows"
              icon={FlaskConical}
              title="Run a simulation"
              desc="Open the Flight Simulator on a workflow"
              tone="violet"
            />
            <QuickAction
              to="/history"
              icon={Activity}
              title="Execution history"
              desc="Inspect logs, responses and contract warnings"
              tone="blue"
            />
          </div>
        </SectionCard>
      </PageBody>
    </div>
  )
}

function QuickAction({ to, icon: Icon, title, desc, tone = 'neon' }) {
  const tones = {
    neon: 'group-hover:border-neon/40 group-hover:text-neon',
    violet: 'group-hover:border-violet/40 group-hover:text-violet',
    blue: 'group-hover:border-electric/40 group-hover:text-electric',
  }
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-xl border border-edge bg-base/40 p-3.5 transition hover:bg-elevated/50"
    >
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-edge bg-elevated text-muted transition', tones[tone])}>
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-xs text-faint">{desc}</p>
      </div>
    </Link>
  )
}
