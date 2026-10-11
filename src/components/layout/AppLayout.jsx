import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar.jsx'
import { Logo } from '../ui/index.js'
import useLocalStorage from '../../hooks/useLocalStorage.js'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useLocalStorage('synq.sidebar.collapsed', false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-base">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="animate-synq-fade absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="animate-synq-pop relative z-10 h-full">
            <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b border-edge bg-sidebar px-3 py-2.5 lg:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-edge text-muted"
            >
              <Menu size={18} />
            </button>
            <Logo size={26} />
          </div>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-edge text-muted"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
