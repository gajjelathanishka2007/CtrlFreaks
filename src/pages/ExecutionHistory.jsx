import { useEffect, useMemo, useState } from 'react'
import { Activity, Eye, SearchX, AlertTriangle, ChevronLeft, ChevronRight, FlaskConical } from 'lucide-react'
import PageHeader, { PageBody } from '../components/layout/PageHeader.jsx'
import DemoBanner from '../components/common/DemoBanner.jsx'
import SearchInput from '../components/common/SearchInput.jsx'
import ExecutionDetail from '../components/history/ExecutionDetail.jsx'
import { Button, Badge, StatusPill, Modal, EmptyState, LoadingBlock } from '../components/ui/index.js'
import { listExecutions, getExecution } from '../services/executionService.js'
import { formatDateTime, formatDuration } from '../utils/format.js'

const STATUS_FILTERS = [
  { id: 'all', label: 'All statuses' },
  { id: 'success', label: 'Success' },
  { id: 'warning', label: 'Warning' },
  { id: 'failed', label: 'Failed' },
]
const MODE_FILTERS = [
  { id: 'all', label: 'All runs' },
  { id: 'production', label: 'Production' },
  { id: 'simulation', label: 'Simulation' },
]

export default function ExecutionHistory() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [mode, setMode] = useState('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(null)
  const limit = 6

  useEffect(() => {
    setPage(1)
  }, [search, status, mode])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    listExecutions({ search, status, mode, page, limit })
      .then(({ data }) => {
        if (alive) setData(data)
      })
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [search, status, mode, page])

  const openDetail = async (row) => {
    setDetail({ id: row.id, workflowName: row.workflowName, status: row.status })
    setDetailError(null)
    setDetailLoading(true)
    try {
      const { data } = await getExecution(row.id)
      setDetail(data)
    } catch (err) {
      setDetailError(err?.message || 'The execution detail could not be loaded. Please try again.')
    } finally {
      setDetailLoading(false)
    }
  }

  const rows = data?.items || []
  const totalPages = data?.totalPages || 1

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        className="border-b border-edge bg-sidebar/40 px-4 py-4 sm:px-6 lg:px-8"
        title="Execution History"
        subtitle="Every run — production and simulation — with logs, responses and contract warnings."
      />

      <PageBody>
        <div className="space-y-4">
          <DemoBanner />

          {/* Filters */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by workflow, ID or trigger…"
              className="w-full lg:max-w-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Select value={status} onChange={setStatus} options={STATUS_FILTERS} label="Status" />
              <Select value={mode} onChange={setMode} options={MODE_FILTERS} label="Run type" />
            </div>
            <p className="text-xs text-faint lg:ml-auto">
              {data ? `${data.total} run${data.total === 1 ? '' : 's'}` : ''}
            </p>
          </div>

          {/* Content */}
          <div className="overflow-hidden rounded-2xl border border-edge bg-card">
            {loading ? (
              <LoadingBlock label="Loading executions…" />
            ) : error ? (
              <EmptyState
                icon={AlertTriangle}
                tone="error"
                title="Couldn’t load executions"
                description={String(error.message || error)}
              />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No executions found"
                description={
                  search || status !== 'all' || mode !== 'all'
                    ? 'Try adjusting your search or filters.'
                    : 'Executions will appear here once your workflows run.'
                }
                action={
                  (search || status !== 'all' || mode !== 'all') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSearch('')
                        setStatus('all')
                        setMode('all')
                      }}
                    >
                      Clear filters
                    </Button>
                  )
                }
              />
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-edge-soft text-[11px] uppercase tracking-wide text-faint">
                        <th className="px-4 py-2.5 font-medium">Workflow</th>
                        <th className="px-4 py-2.5 font-medium">Execution ID</th>
                        <th className="px-4 py-2.5 font-medium">Triggered</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 font-medium">Duration</th>
                        <th className="px-4 py-2.5 font-medium">Type</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-b border-edge-soft/60 transition last:border-0 hover:bg-elevated/40">
                          <td className="max-w-[220px] px-4 py-3">
                            <p className="truncate font-medium text-ink">{r.workflowName}</p>
                            <p className="truncate text-xs text-faint">{r.trigger}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted">{r.id}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{formatDateTime(r.startedAt)}</td>
                          <td className="px-4 py-3">
                            <StatusPill status={r.status} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{formatDuration(r.durationMs)}</td>
                          <td className="px-4 py-3">
                            <Badge tone={r.mode === 'simulation' ? 'violet' : 'blue'} dot>
                              {r.mode === 'simulation' ? 'Simulation' : 'Production'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button size="xs" variant="outline" onClick={() => openDetail(r)}>
                              <Eye size={13} /> View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <ul className="divide-y divide-edge-soft md:hidden">
                  {rows.map((r) => (
                    <li key={r.id} className="p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-ink">{r.workflowName}</p>
                        <StatusPill status={r.status} />
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-faint">{r.id}</p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                        <span>{formatDateTime(r.startedAt)}</span>·<span>{formatDuration(r.durationMs)}</span>·
                        <Badge tone={r.mode === 'simulation' ? 'violet' : 'blue'}>
                          {r.mode === 'simulation' ? 'Sim' : 'Prod'}
                        </Badge>
                      </div>
                      <Button size="xs" variant="outline" className="mt-2.5 w-full" onClick={() => openDetail(r)}>
                        <Eye size={13} /> View details
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Pagination */}
            {!loading && !error && rows.length > 0 && (
              <div className="flex items-center justify-between gap-3 border-t border-edge-soft px-4 py-3">
                <p className="text-xs text-faint">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={14} /> Prev
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </PageBody>

      <Modal
        open={!!detail}
        onClose={() => {
          setDetail(null)
          setDetailError(null)
        }}
        title={detail?.workflowName || 'Execution'}
        description={detail?.id ? `Execution ${detail.id}` : undefined}
        size="lg"
      >
        {detailLoading ? (
          <LoadingBlock label="Loading execution detail…" />
        ) : detailError ? (
          <EmptyState
            icon={AlertTriangle}
            tone="error"
            title="Couldn’t load execution"
            description={detailError}
          />
        ) : (
          <ExecutionDetail execution={detail} />
        )}
      </Modal>
    </div>
  )
}

function Select({ value, onChange, options, label }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="synq-input h-9 w-auto appearance-none pr-8 text-xs"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-elevated">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronRight size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-faint" />
    </label>
  )
}
