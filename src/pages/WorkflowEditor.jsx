import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import {
  ChevronRight,
  Save,
  FlaskConical,
  Share2,
  Rocket,
  Sparkles,
  SlidersHorizontal,
  ChevronLeft,
  Loader2,
  Copy,
  ExternalLink,
} from 'lucide-react'
import WorkflowCanvas from '../components/workflow/WorkflowCanvas.jsx'
import NodeConfigPanel from '../components/workflow/NodeConfigPanel.jsx'
import DiagnosticsDrawer from '../components/workflow/DiagnosticsDrawer.jsx'
import SimulatorPanel from '../components/simulator/SimulatorPanel.jsx'
import AssistantPanel from '../components/assistant/AssistantPanel.jsx'
import useWorkflowGraph from '../components/workflow/useWorkflowGraph.js'
import { Button, Tooltip, Modal, EmptyState } from '../components/ui/index.js'
import { useWorkflows } from '../context/WorkflowsContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { demoContractIssues } from '../data/mock.js'
import { starterGraph } from '../services/mockStore.js'
import { NODE_BY_ID } from '../data/nodeCatalog.js'
import { cn } from '../utils/cn.js'

export default function WorkflowEditor() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { getById, loading, saveGraph, rename, publish } = useWorkflows()
  const { toast } = useToast()

  const wf = getById(id)
  const graph = useWorkflowGraph({ nodes: [], edges: [] })
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    selectedNode,
    selectedNodeId,
    setSelected,
    selectedDef,
    addNode,
    updateNodeData,
    deleteNode,
    connect,
    undo,
    redo,
    canUndo,
    canRedo,
    resetGraph,
    onNodeDragStart,
    dirty,
    markSaved,
    takeSnapshot,
  } = graph

  const [ready, setReady] = useState(false)
  const [name, setName] = useState('Untitled Workflow')
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [railOpen, setRailOpen] = useState(false)
  const [railMode, setRailMode] = useState('assistant')
  const [simOpen, setSimOpen] = useState(false)
  const [diagOpen, setDiagOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState(null)
  const loadedIdRef = useRef(null)

  // Load graph when the workflow becomes available or changes.
  useEffect(() => {
    if (loading || !wf) return
    if (loadedIdRef.current === wf.id) return
    loadedIdRef.current = wf.id
    resetGraph(wf.graph || starterGraph())
    setName(wf.name || 'Untitled Workflow')
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, wf?.id])

  // Auto-open simulator via ?simulate=1
  useEffect(() => {
    if (ready && params.get('simulate') === '1') {
      setSimOpen(true)
      params.delete('simulate')
      setParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  // Select node → open its configuration.
  // React Flow can emit onSelectionChange repeatedly (e.g. when the callback
  // identity changes), so only react when the selected id actually changes.
  const lastSelRef = useRef(null)
  const handleSelectionChange = useCallback(
    (nodeId) => {
      const changed = nodeId !== lastSelRef.current
      lastSelRef.current = nodeId
      setSelected(nodeId)
      if (nodeId && changed) {
        setRailMode('configure')
        setRailOpen(true)
      }
    },
    [setSelected],
  )

  const handleAddNode = useCallback(
    (def, position) => {
      addNode(def, position)
      setRailMode('configure')
      setRailOpen(true)
      toast({ type: 'success', title: 'Node added', message: `“${def.name}” was placed on the canvas.` })
    },
    [addNode, toast],
  )

  const handleSave = useCallback(async () => {
    if (!wf) return
    setSaving(true)
    try {
      if (name !== wf.name) await rename(wf.id, name.trim() || 'Untitled Workflow')
      const { demo } = await saveGraph(wf.id, { nodes, edges })
      markSaved()
      toast(
        demo
          ? { type: 'info', title: 'Saved locally', message: 'Saved to the demo store. A connected backend will persist this server-side.' }
          : { type: 'success', title: 'Workflow saved', message: 'Your changes were saved.' },
      )
    } catch (err) {
      toast({
        type: 'error',
        title: 'Save failed',
        message: err?.message || 'Your changes could not be saved. Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }, [wf, name, nodes, edges, rename, saveGraph, markSaved, toast])

  const handlePublish = useCallback(async () => {
    if (!wf) return
    setPublishing(true)
    try {
      const { demo } = await publish(wf.id)
      toast(
        demo
          ? {
              type: 'info',
              title: 'Demo publish',
              message: 'No automation engine is connected, so this only marked the workflow active locally. Real publishing requires engine confirmation.',
            }
          : { type: 'success', title: 'Published', message: `${name} is now active.` },
      )
    } catch (err) {
      toast({
        type: 'error',
        title: 'Publish failed',
        message: err?.message || 'The workflow could not be published. Please try again.',
      })
    } finally {
      setPublishing(false)
    }
  }, [wf, publish, name, toast])

  const openAssistant = useCallback((prompt) => {
    setRailMode('assistant')
    setRailOpen(true)
    if (prompt) setPendingPrompt(prompt)
  }, [])

  const applyMapping = useCallback(
    (issue) => {
      const def = NODE_BY_ID['transform.map']
      const position = { x: 480, y: 420 }
      const newId = addNode(def, position)
      if (newId) {
        updateNodeData(newId, {
          label: `Map ${issue.suggestion.from} → ${issue.suggestion.to}`,
          config: { mappings: [{ key: issue.suggestion.from, value: issue.suggestion.to }] },
        })
      }
      setDiagOpen(false)
      setRailMode('configure')
      setRailOpen(true)
      toast({
        type: 'success',
        title: 'Mapping added',
        message: `A Map Fields node (${issue.suggestion.from} → ${issue.suggestion.to}) was added. Review it and save the workflow.`,
      })
    },
    [addNode, updateNodeData, toast],
  )

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase()
      const typing = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSave()
      } else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey && !typing) {
        e.preventDefault()
        undo()
      } else if (mod && ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') && !typing) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave, undo, redo])

  const diagnosticsCount = demoContractIssues.length

  if (loading && !ready) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        <Loader2 size={22} className="animate-spin text-neon" />
      </div>
    )
  }

  if (!wf) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-edge bg-card">
          <EmptyState
            icon={FlaskConical}
            title="Workflow not found"
            description="This workflow either doesn’t exist or was deleted."
            action={
              <Button size="sm" variant="primary" onClick={() => navigate('/workflows')}>
                Back to workflows
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <div className="flex h-full flex-col">
        {/* Header */}
        <header className="z-20 flex flex-wrap items-center gap-2 border-b border-edge bg-sidebar px-3 py-2.5 sm:px-4">
          <Tooltip label="Back to workflows">
            <Link
              to="/workflows"
              aria-label="Back to workflows"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-elevated hover:text-ink"
            >
              <ChevronLeft size={17} />
            </Link>
          </Tooltip>

          <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
            <Link to="/workflows" className="hidden shrink-0 text-muted transition hover:text-ink sm:inline">
              Workflows
            </Link>
            <ChevronRight size={14} className="hidden shrink-0 text-faint sm:inline" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name !== wf.name && rename(wf.id, name.trim() || 'Untitled Workflow')}
              aria-label="Workflow name"
              className="min-w-[140px] max-w-[260px] truncate rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[14px] font-semibold text-ink transition hover:border-edge focus:border-neon/50 focus:outline-none"
            />
            {dirty && <span className="shrink-0 text-[11px] text-warning">• unsaved</span>}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Tooltip label="Open Synq Assistant">
              <Button variant="ai" size="sm" onClick={() => openAssistant()}>
                <Sparkles size={15} />
                <span className="hidden sm:inline">Assistant</span>
              </Button>
            </Tooltip>
            <Button variant="secondary" size="sm" onClick={() => setShareOpen(true)}>
              <Share2 size={15} />
              <span className="hidden sm:inline">Share</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setSimOpen(true)}>
              <FlaskConical size={15} />
              <span className="hidden sm:inline">Test Workflow</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSave} loading={saving}>
              <Save size={15} />
              <span className="hidden sm:inline">Save</span>
            </Button>
            <Button variant="primary" size="sm" onClick={handlePublish} loading={publishing}>
              <Rocket size={15} />
              <span className="hidden sm:inline">Publish Flow</span>
            </Button>
          </div>
        </header>

        {/* Body */}
        <div className="relative flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1">
            <WorkflowCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={connect}
              onNodeDragStart={onNodeDragStart}
              onSelectionChange={handleSelectionChange}
              onAddNode={handleAddNode}
              onSimulate={() => setSimOpen(true)}
              onDiagnostics={() => setDiagOpen(true)}
              diagnosticsCount={diagnosticsCount}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
              ready={ready}
            />
          </div>

          {/* Right rail */}
          {railOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/50 xl:hidden"
                onClick={() => setRailOpen(false)}
                aria-hidden="true"
              />
              <aside className="fixed inset-y-0 right-0 z-50 flex w-[min(92vw,372px)] flex-col border-l border-edge bg-sidebar xl:static xl:z-auto xl:w-[372px]">
                <div className="flex items-center gap-1 border-b border-edge px-2.5 py-2">
                  <RailTab
                    active={railMode === 'configure'}
                    onClick={() => setRailMode('configure')}
                    icon={SlidersHorizontal}
                    label="Configure"
                    disabled={!selectedNode}
                  />
                  <RailTab
                    active={railMode === 'assistant'}
                    onClick={() => setRailMode('assistant')}
                    icon={Sparkles}
                    label="Assistant"
                  />
                  <Tooltip label="Collapse panel" side="left">
                    <button
                      onClick={() => setRailOpen(false)}
                      aria-label="Collapse panel"
                      className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-elevated hover:text-ink"
                    >
                      <ChevronRight size={17} />
                    </button>
                  </Tooltip>
                </div>

                <div className="min-h-0 flex-1">
                  {railMode === 'configure' && selectedNode && selectedDef ? (
                    <NodeConfigPanel
                      node={selectedNode}
                      def={selectedDef}
                      onUpdate={updateNodeData}
                      onEditStart={takeSnapshot}
                      onDelete={deleteNode}
                      onClose={() => {
                        setSelected(null)
                        setRailMode('assistant')
                      }}
                      onSaveNode={handleSave}
                      onRequestAI={(prompt) => {
                        setRailMode('assistant')
                        setPendingPrompt(prompt)
                      }}
                    />
                  ) : (
                    <AssistantPanel
                      workflowName={name}
                      nodeName={selectedNode?.data?.label}
                      onClose={() => setRailOpen(false)}
                      pendingPrompt={pendingPrompt}
                      onConsumePrompt={() => setPendingPrompt(null)}
                    />
                  )}
                </div>
              </aside>
            </>
          )}

          {/* Reopen rail */}
          {!railOpen && (
            <Tooltip label="Open panel" side="left">
              <button
                onClick={() => setRailOpen(true)}
                aria-label="Open panel"
                className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-edge bg-elevated/90 text-muted backdrop-blur transition hover:text-ink"
              >
                <ChevronLeft size={17} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <SimulatorPanel open={simOpen} onClose={() => setSimOpen(false)} workflow={{ id: wf.id, graph: { nodes, edges } }} />
      <DiagnosticsDrawer
        open={diagOpen}
        onClose={() => setDiagOpen(false)}
        onApplyMapping={applyMapping}
        onToast={toast}
      />

      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        size="sm"
        title="Share workflow"
        description="Invite teammates to view or edit this workflow."
        footer={
          <Button variant="ghost" size="sm" onClick={() => setShareOpen(false)}>
            Done
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-edge bg-base/50 p-2.5">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted">
              https://app.synq.dev/w/{wf.id}
            </code>
            <Button
              size="iconSm"
              variant="secondary"
              aria-label="Copy link"
              onClick={() =>
                toast({ type: 'success', title: 'Link copied', message: 'Share link copied to clipboard.' })
              }
            >
              <Copy size={14} />
            </Button>
          </div>
          <p className="flex items-start gap-1.5 text-[11px] text-faint">
            <ExternalLink size={12} className="mt-0.5 shrink-0" />
            Sharing sends invitations through the backend. In demo mode this link is illustrative only.
          </p>
        </div>
      </Modal>
    </ReactFlowProvider>
  )
}

function RailTab({ active, onClick, icon: Icon, label, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition',
        'disabled:cursor-not-allowed disabled:opacity-40',
        active ? 'bg-neon/12 text-neon' : 'text-muted hover:bg-elevated hover:text-ink',
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}
