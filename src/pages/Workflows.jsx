import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Workflow as WorkflowIcon, SearchX, AlertTriangle } from 'lucide-react'
import PageHeader, { PageBody } from '../components/layout/PageHeader.jsx'
import DemoBanner from '../components/common/DemoBanner.jsx'
import SearchInput from '../components/common/SearchInput.jsx'
import Tabs from '../components/common/Tabs.jsx'
import WorkflowCard from '../components/workflow/WorkflowCard.jsx'
import { Button, Modal, EmptyState, SkeletonRows } from '../components/ui/index.js'
import { useWorkflows } from '../context/WorkflowsContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'draft', label: 'Draft' },
  { id: 'paused', label: 'Paused' },
]

export default function Workflows() {
  const { workflows, loading, error, demo, create, rename, publish, remove, refresh } = useWorkflows()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return workflows.filter((w) => {
      if (filter !== 'all' && w.status !== filter) return false
      if (!q) return true
      return w.name.toLowerCase().includes(q) || (w.description || '').toLowerCase().includes(q)
    })
  }, [workflows, query, filter])

  const counts = useMemo(
    () => ({
      all: workflows.length,
      active: workflows.filter((w) => w.status === 'active').length,
      draft: workflows.filter((w) => w.status === 'draft').length,
      paused: workflows.filter((w) => w.status === 'paused').length,
    }),
    [workflows],
  )

  const createWorkflow = async () => {
    setCreating(true)
    try {
      const { workflow } = await create({ name: 'Untitled Workflow' })
      toast({ type: 'success', title: 'Workflow created', message: '“Untitled Workflow” is ready to edit.' })
      navigate(`/workflows/${workflow.id}`)
    } catch (err) {
      toast({
        type: 'error',
        title: 'Could not create workflow',
        message: err?.message || 'Something went wrong. Please try again.',
      })
    } finally {
      setCreating(false)
    }
  }

  const onRename = async (id, name) => {
    try {
      await rename(id, name)
      toast({ type: 'success', title: 'Renamed', message: `Workflow renamed to “${name}”.` })
    } catch (err) {
      toast({
        type: 'error',
        title: 'Rename failed',
        message: err?.message || 'The workflow could not be renamed. Please try again.',
      })
    }
  }

  const onPublish = async (wf) => {
    try {
      const { demo } = await publish(wf.id)
      toast(
        demo
          ? {
              type: 'info',
              title: 'Demo publish',
              message: `${wf.name} was marked active locally. Real publishing requires the backend/engine to confirm success.`,
            }
          : { type: 'success', title: 'Published', message: `${wf.name} is now active.` },
      )
    } catch (err) {
      toast({
        type: 'error',
        title: 'Publish failed',
        message: err?.message || 'The workflow could not be published. Please try again.',
      })
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await remove(pendingDelete.id)
      toast({ type: 'success', title: 'Workflow deleted', message: `“${pendingDelete.name}” was removed.` })
      setPendingDelete(null)
    } catch (err) {
      toast({
        type: 'error',
        title: 'Delete failed',
        message: err?.message || 'The workflow could not be deleted. Please try again.',
      })
    } finally {
      setDeleting(false)
    }
  }

  const isSearching = query.trim().length > 0

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        className="border-b border-edge bg-sidebar/40 px-4 py-4 sm:px-6 lg:px-8"
        title="Workflows"
        subtitle="Create, organise, and improve your automations."
        actions={
          <Button variant="primary" size="sm" onClick={createWorkflow} loading={creating}>
            <Plus size={15} /> Create Workflow
          </Button>
        }
      />

      <PageBody>
        <div className="space-y-4">
          <DemoBanner />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              tabs={FILTERS.map((f) => ({ ...f, count: counts[f.id] }))}
              value={filter}
              onChange={setFilter}
            />
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search workflows…"
              className="w-full sm:w-72"
            />
          </div>

          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-error/30 bg-error/8 p-3 text-error">
              <AlertTriangle size={16} />
              <p className="text-sm">Could not load workflows. {String(error.message || error)}</p>
              <Button size="xs" variant="outline" className="ml-auto" onClick={refresh}>
                Retry
              </Button>
            </div>
          )}

          {loading ? (
            <SkeletonRows rows={4} />
          ) : filtered.length === 0 ? (
            isSearching ? (
              <div className="rounded-2xl border border-edge bg-card">
                <EmptyState
                  icon={SearchX}
                  title="No matching workflows"
                  description={`Nothing matched “${query}”. Try a different search or clear the filter.`}
                  action={
                    <Button size="sm" variant="outline" onClick={() => setQuery('')}>
                      Clear search
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-edge bg-card">
                <EmptyState
                  icon={WorkflowIcon}
                  title="No workflows yet"
                  description="Create your first workflow and connect your apps, APIs, and data."
                  action={
                    <Button size="sm" variant="primary" onClick={createWorkflow}>
                      <Plus size={14} /> Create Workflow
                    </Button>
                  }
                />
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((w) => (
                <WorkflowCard
                  key={w.id}
                  workflow={w}
                  onRename={onRename}
                  onPublish={onPublish}
                  onDelete={setPendingDelete}
                  onTest={(wf) => navigate(`/workflows/${wf.id}?simulate=1`)}
                />
              ))}
            </div>
          )}
        </div>
      </PageBody>

      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete workflow?"
        description="This removes the workflow from your workspace. This cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete} loading={deleting}>
              Delete workflow
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          You are about to delete{' '}
          <span className="font-semibold text-ink">“{pendingDelete?.name}”</span>.
        </p>
      </Modal>
    </div>
  )
}
