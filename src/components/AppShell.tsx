import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import { Button } from './ui'
import { cn } from '../lib/utils'
import { useStore } from '../store/useStore'

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'LayoutDashboard', end: true },
  { to: '/templates', label: 'Templates', icon: 'Boxes' },
  { to: '/executions', label: 'Executions', icon: 'History' },
  { to: '/settings', label: 'Settings', icon: 'Settings' },
]

export function AppShell() {
  const navigate = useNavigate()
  const createWorkflow = useStore((s) => s.createWorkflow)
  const [open, setOpen] = useState(false)

  const handleNew = () => {
    const workflow = createWorkflow()
    navigate(`/builder/${workflow.id}`)
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-ink-700/70 bg-ink-900/95 backdrop-blur transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-grape-500 text-white shadow-lg">
            <Icon name="Zap" size={18} />
          </span>
          <div>
            <p className="text-sm font-bold tracking-tight text-white">CtrlFreaks</p>
            <p className="text-[10px] tracking-wide text-ink-400 uppercase">Workflow automation</p>
          </div>
        </div>

        <div className="px-3">
          <Button variant="primary" className="w-full" onClick={handleNew}>
            <Icon name="Plus" size={16} /> New workflow
          </Button>
        </div>

        <nav className="mt-4 flex-1 space-y-0.5 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent-500/15 text-accent-400'
                    : 'text-ink-300 hover:bg-ink-800 hover:text-white',
                )
              }
            >
              <Icon name={item.icon} size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-ink-700/70 p-3">
          <div className="rounded-lg border border-ink-700 bg-ink-850/80 p-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink-200">
              <Icon name="Sparkles" size={12} className="text-grape-400" /> AI-ready
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-ink-400">
              The AI nodes run on a labelled demo adapter — add a provider key in Settings to go live.
            </p>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-ink-700/70 bg-ink-900/60 px-4 py-2.5 lg:hidden">
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-md p-1.5 text-ink-300 hover:bg-ink-800 hover:text-white"
            aria-label="Toggle navigation"
          >
            <Icon name="Menu" size={18} />
          </button>
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <Icon name="Zap" size={15} className="text-accent-400" /> CtrlFreaks
          </span>
        </header>

        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
