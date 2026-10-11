import { Panel } from '@xyflow/react'
import { Plus, Undo2, Redo2, FlaskConical, ShieldAlert, Maximize2 } from 'lucide-react'
import Tooltip from '../ui/Tooltip.jsx'
import { cn } from '../../utils/cn.js'

function ToolButton({ icon: Icon, label, onClick, disabled, active, variant = 'default' }) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg border transition',
          'disabled:cursor-not-allowed disabled:opacity-40',
          active
            ? 'border-neon/40 bg-neon/12 text-neon'
            : 'border-edge bg-elevated/90 text-muted hover:border-[#3b424d] hover:text-ink',
          variant === 'danger' && 'hover:text-warning',
        )}
      >
        <Icon size={16} />
      </button>
    </Tooltip>
  )
}

export default function BottomToolbar({
  onAdd,
  addOpen,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onFit,
  onSimulate,
  onDiagnostics,
  diagnosticsCount = 0,
}) {
  return (
    <Panel position="bottom-center" className="!m-0 !mb-4">
      <div className="flex items-center gap-1.5 rounded-2xl border border-edge bg-elevated/95 p-1.5 shadow-panel backdrop-blur">
        <ToolButton icon={Undo2} label="Undo (Ctrl+Z)" onClick={onUndo} disabled={!canUndo} />
        <ToolButton icon={Redo2} label="Redo (Ctrl+Shift+Z)" onClick={onRedo} disabled={!canRedo} />

        <span className="mx-0.5 h-6 w-px bg-edge" />

        {/* Primary Add Node button */}
        <Tooltip label="Add Node / Integration">
          <button
            onClick={onAdd}
            aria-label="Add Node / Integration"
            aria-expanded={addOpen}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl border-2 transition',
              addOpen
                ? 'border-neon bg-neon text-[#04140D]'
                : 'border-neon/70 bg-neon/12 text-neon hover:bg-neon/20',
              'shadow-[0_0_0_1px_rgba(25,230,140,0.25),0_0_20px_-4px_rgba(25,230,140,0.6)]',
            )}
          >
            <Plus size={20} className={cn(addOpen && 'rotate-45 transition-transform')} />
          </button>
        </Tooltip>

        <span className="mx-0.5 h-6 w-px bg-edge" />

        <ToolButton icon={Maximize2} label="Fit view" onClick={onFit} />
        <div className="relative">
          <ToolButton
            icon={ShieldAlert}
            label="Data-contract diagnostics"
            onClick={onDiagnostics}
            variant="danger"
            active={diagnosticsCount > 0}
          />
          {diagnosticsCount > 0 && (
            <span className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[9px] font-bold text-[#1a1400]">
              {diagnosticsCount}
            </span>
          )}
        </div>
        <ToolButton icon={FlaskConical} label="Open Flight Simulator" onClick={onSimulate} />

        <span className="mx-0.5 h-6 w-px bg-edge" />
        <span className="px-2 text-[11px] text-faint">Synq</span>
      </div>
    </Panel>
  )
}
