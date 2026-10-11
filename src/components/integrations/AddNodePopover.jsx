import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Plus, KeyRound, SearchX, Sparkles } from 'lucide-react'
import { PICKER_TABS, NODE_CATEGORIES, searchCatalog } from '../../data/nodeCatalog.js'
import SearchInput from '../common/SearchInput.jsx'
import Tabs from '../common/Tabs.jsx'
import Badge from '../ui/Badge.jsx'
import { Button } from '../ui/index.js'
import { cn } from '../../utils/cn.js'

const CATEGORY_LABEL = Object.fromEntries(NODE_CATEGORIES.map((c) => [c.id, c.label]))

/**
 * Bottom-center "Add Node / Integration" popover.
 * Search filters by name, description and category — it is a real filter.
 */
export default function AddNodePopover({ open, onClose, onSelect }) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all')
  const panelRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setTab('all')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const results = useMemo(() => searchCatalog(query, tab), [query, tab])

  // Tab counts reflect the current search so the UI never feels dead.
  const tabCounts = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = {}
    for (const t of PICKER_TABS) {
      base[t.id] = searchCatalog(q, t.id).length
    }
    return base
  }, [query])

  if (!open) return null

  const isSearching = query.trim().length > 0

  return (
    <>
      {/* Click-outside backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />

      <div
        ref={panelRef}
        role="dialog"
        aria-label="Add Node / Integration"
        className="animate-synq-pop fixed bottom-24 left-1/2 z-50 w-[min(94vw,780px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-edge bg-elevated shadow-panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-edge px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-neon/12 text-neon">
              <Plus size={15} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink">Add Node / Integration</h2>
              <p className="text-[11px] text-faint">
                {results.length} result{results.length === 1 ? '' : 's'}
                {isSearching ? ` for “${query.trim()}”` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-card hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-edge px-4 py-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search nodes, integrations and code…"
            autoFocus
          />
        </div>

        {/* Tabs */}
        <div className="border-b border-edge px-3 py-2">
          <Tabs
            tabs={PICKER_TABS.map((t) => ({ ...t, count: tabCounts[t.id] }))}
            value={tab}
            onChange={setTab}
            size="sm"
            scroll
          />
        </div>

        {/* Results */}
        <div className="max-h-[52vh] overflow-y-auto p-3 synq-scroll">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-edge bg-card">
                <SearchX size={20} className="text-faint" />
              </div>
              <p className="text-sm font-medium text-ink">No results found</p>
              <p className="max-w-xs text-xs text-muted">
                Nothing matched “{query.trim()}”. Try “code”, “email”, “database”, or clear the search.
              </p>
              {isSearching && (
                <Button size="xs" variant="outline" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {results.map((def) => (
                <NodeResultCard key={def.id} def={def} onSelect={onSelect} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function NodeResultCard({ def, onSelect }) {
  const Icon = def.icon
  const accents = {
    blue: 'text-electric bg-electric/12',
    green: 'text-neon bg-neon/12',
    violet: 'text-violet bg-violet/12',
    red: 'text-error bg-error/12',
  }
  return (
    <button
      onClick={() => onSelect(def)}
      className={cn(
        'group flex w-full items-start gap-3 rounded-xl border border-edge bg-card p-3 text-left transition',
        'hover:border-neon/40 hover:bg-[#1a1f26]',
      )}
    >
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', accents[def.accent] || accents.blue)}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13px] font-semibold text-ink">{def.name}</p>
          {def.isAI && <Sparkles size={12} className="shrink-0 text-violet" />}
          {def.requiresCredentials && <KeyRound size={12} className="shrink-0 text-warning" title="Requires credentials" />}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted">{def.description}</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <Badge tone="neutral" className="!text-[10px]">
            {CATEGORY_LABEL[def.category] || def.category}
          </Badge>
          {def.isIntegration && (
            <Badge tone="blue" className="!text-[10px]">
              Integration
            </Badge>
          )}
          {def.requiresCredentials && (
            <span className="text-[10px] text-warning">Credentials required</span>
          )}
        </div>
      </div>
    </button>
  )
}
