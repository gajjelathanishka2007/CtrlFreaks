import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Workflow,
  History,
  Users,
  Settings,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  FolderKanban,
  Plus,
} from 'lucide-react'
import { cn } from '../../utils/cn.js'
import { Logo, Tooltip, Badge } from '../ui/index.js'
import { demoProjects } from '../../data/mock.js'
import { useWorkflows } from '../../context/WorkflowsContext.jsx'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/workflows', label: 'Workflows', icon: Workflow },
  { to: '/history', label: 'Execution History', icon: History },
  { to: '/teams', label: 'Teams', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate()
  const { workflows, create } = useWorkflows()
  const [expanded, setExpanded] = useState(() => new Set(['proj_revenue']))

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const createNew = async () => {
    const { workflow } = await create({ name: 'Untitled Workflow' })
    navigate(`/workflows/${workflow.id}`)
  }

  return (
    <aside
      className={cn(
        'z-30 flex h-full shrink-0 flex-col border-r border-edge bg-sidebar transition-[width] duration-200',
        collapsed ? 'w-[68px]' : 'w-[250px]',
      )}
    >
      {/* Brand */}
      <div className={cn('flex h-14 items-center border-b border-edge-soft', collapsed ? 'justify-center px-2' : 'justify-between px-3.5')}>
        <NavLink to="/" className="flex items-center rounded-lg focus-visible:outline-none">
          <Logo size={30} withWordmark={!collapsed} />
        </NavLink>
        {!collapsed && (
          <Tooltip label="Collapse sidebar" side="bottom">
            <button
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-elevated hover:text-ink"
            >
              <PanelLeftClose size={17} />
            </button>
          </Tooltip>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center py-2">
          <Tooltip label="Expand sidebar" side="right">
            <button
              onClick={onToggle}
              aria-label="Expand sidebar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-elevated hover:text-ink"
            >
              <PanelLeftOpen size={17} />
            </button>
          </Tooltip>
        </div>
      )}

      {/* Navigation */}
      <nav className={cn('flex flex-col gap-0.5 py-3', collapsed ? 'px-2' : 'px-2.5')}>
        {NAV.map((item) => (
          <NavItem key={item.to} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Projects */}
      <div className={cn('flex min-h-0 flex-1 flex-col', collapsed ? 'px-2' : 'px-2.5')}>
        {!collapsed ? (
          <>
            <div className="flex items-center justify-between px-2 pb-1.5 pt-2">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
                <FolderKanban size={13} /> Projects
              </span>
              <Tooltip label="New workflow" side="right">
                <button
                  onClick={createNew}
                  aria-label="Create workflow"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-faint transition hover:bg-elevated hover:text-neon"
                >
                  <Plus size={14} />
                </button>
              </Tooltip>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-2 synq-scroll">
              {demoProjects.map((proj) => {
                const isOpen = expanded.has(proj.id)
                const projWorkflows = workflows.filter((w) => w.projectId === proj.id)
                return (
                  <div key={proj.id} className="mb-0.5">
                    <button
                      onClick={() => toggle(proj.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[13px] font-medium text-muted transition hover:bg-elevated/70 hover:text-ink"
                    >
                      {isOpen ? <ChevronDown size={14} className="text-faint" /> : <ChevronRight size={14} className="text-faint" />}
                      <span className="truncate">{proj.name}</span>
                    </button>
                    {isOpen && (
                      <div className="ml-3.5 mt-0.5 flex flex-col gap-0.5 border-l border-edge-soft pl-2">
                        {(projWorkflows.length ? projWorkflows : proj.workflows).map((w) => (
                          <NavLink
                            key={w.id}
                            to={`/workflows/${w.id}`}
                            className={({ isActive }) =>
                              cn(
                                'truncate rounded-md px-2 py-1 text-[12.5px] transition',
                                isActive ? 'text-neon' : 'text-faint hover:bg-elevated/60 hover:text-muted',
                              )
                            }
                          >
                            {w.name}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="flex-1" />
        )}
      </div>

      {/* Upgrade card + profile */}
      <div className={cn('border-t border-edge-soft p-2.5', collapsed && 'px-2')}>
        {!collapsed && (
          <div className="mb-2.5 rounded-xl border border-violet/30 bg-violet/8 p-3">
            <div className="flex items-center gap-2 text-violet">
              <Sparkles size={15} />
              <span className="text-xs font-semibold">Synq Pro</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Unlock unlimited simulation runs and team analytics.
            </p>
            <button className="mt-2.5 w-full rounded-lg bg-violet/20 px-3 py-1.5 text-xs font-semibold text-violet transition hover:bg-violet/30">
              Upgrade
            </button>
          </div>
        )}
        <div className={cn('flex items-center gap-2.5 rounded-xl p-1.5', !collapsed && 'hover:bg-elevated/60')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neon/70 to-electric/70 text-[12px] font-bold text-[#04140D]">
            SR
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-ink">Sri Rao</p>
              <p className="truncate text-[11px] text-faint">sri@synq.dev</p>
            </div>
          )}
          {!collapsed && <Badge tone="neon" className="shrink-0">Pro</Badge>}
        </div>
      </div>
    </aside>
  )
}

function NavItem({ item, collapsed }) {
  const Icon = item.icon
  return (
    <Tooltip label={collapsed ? item.label : ''} side="right">
      <NavLink
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          cn(
            'group flex items-center gap-2.5 rounded-lg text-[13.5px] font-medium transition',
            collapsed ? 'h-10 justify-center' : 'px-2.5 py-2',
            isActive
              ? 'bg-neon/10 text-neon'
              : 'text-muted hover:bg-elevated/70 hover:text-ink',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon size={17} className={cn('shrink-0', isActive ? 'text-neon' : 'text-faint group-hover:text-muted')} />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </>
        )}
      </NavLink>
    </Tooltip>
  )
}
