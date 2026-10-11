import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge as rfAddEdge,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react'

import { useStore } from '../store/useStore'
import { getNodeDefinition, getOutputPorts } from '../engine/registry'
import { validateWorkflow } from '../engine/validation'
import { runWorkflow } from '../engine/orchestrator'
import { safeClone } from '../engine/nodes/helpers'
import type { Execution } from '../engine/types'
import type { NodeType, WorkflowNode } from '../types/workflow'

import { NodePalette, NODE_DRAG_TYPE } from '../components/NodePalette'
import { nodeTypes } from '../components/FlowNode'
import { ConfigPanel } from '../components/ConfigPanel'
import { ExecutionPanel } from '../components/ExecutionPanel'
import { ValidationPanel } from '../components/ValidationPanel'
import { RunDialog } from '../components/RunDialog'
import { Icon } from '../components/Icon'
import { Badge, Button } from '../components/ui'
import { cn, timeAgo } from '../lib/utils'

type RightTab = 'node' | 'validation' | 'execution'

export function Builder() {
  return (
    <ReactFlowProvider>
      <BuilderInner />
    </ReactFlowProvider>
  )
}

function BuilderInner() {
  const { workflowId } = useParams()
  const navigate = useNavigate()
  const { screenToFlowPosition } = useReactFlow()

  const workflows = useStore((s) => s.workflows)
  const executions = useStore((s) => s.executions)
  const addNode = useStore((s) => s.addNode)
  const updateNodeConfig = useStore((s) => s.updateNodeConfig)
  const renameNode = useStore((s) => s.renameNode)
  const toggleNodeDisabled = useStore((s) => s.toggleNodeDisabled)
  const removeNode = useStore((s) => s.removeNode)
  const duplicateNode = useStore((s) => s.duplicateNode)
  const addEdge = useStore((s) => s.addEdge)
  const applyNodeChanges = useStore((s) => s.applyNodeChanges)
  const applyEdgeChanges = useStore((s) => s.applyEdgeChanges)
  const renameWorkflow = useStore((s) => s.renameWorkflow)
  const recordExecution = useStore((s) => s.recordExecution)

  const workflow = useMemo(() => workflows.find((w) => w.id === workflowId), [workflows, workflowId])

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<RightTab>('execution')
  const [runOpen, setRunOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [liveExecution, setLiveExecution] = useState<Execution | null>(null)
  const cancelRef = useRef<{ aborted: boolean }>({ aborted: false })
  const wrapperRef = useRef<HTMLDivElement>(null)

  const validation = useMemo(() => validateWorkflow(workflow), [workflow])

  // Most recent persisted execution for this workflow (used when nothing is live).
  const latestExecution = useMemo(
    () => executions.find((e) => e.workflowId === workflowId) ?? null,
    [executions, workflowId],
  )
  const displayedExecution = liveExecution ?? latestExecution

  const statusByNode = useMemo(() => {
    const map: Record<string, Execution['nodeResults'][number]['status']> = {}
    if (liveExecution) for (const r of liveExecution.nodeResults) map[r.nodeId] = r.status
    else if (latestExecution) for (const r of latestExecution.nodeResults) map[r.nodeId] = r.status
    return map
  }, [liveExecution, latestExecution])

  const selectedNode = useMemo(
    () => workflow?.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [workflow, selectedNodeId],
  )

  // Clear the selection if the node disappears (e.g. deleted with the keyboard).
  useEffect(() => {
    if (selectedNodeId && workflow && !workflow.nodes.some((n) => n.id === selectedNodeId)) {
      setSelectedNodeId(null)
    }
  }, [workflow, selectedNodeId])

  const rfNodes: Node[] = useMemo(() => {
    if (!workflow) return []
    return workflow.nodes.map((node) => {
      const def = getNodeDefinition(node.type)
      return {
        id: node.id,
        type: 'cf',
        position: node.position,
        selected: node.id === selectedNodeId,
        data: {
          label: node.name,
          nodeType: node.type,
          category: def?.category ?? 'data',
          icon: def?.icon ?? 'Circle',
          disabled: node.disabled,
          demoOnly: def?.demoOnly,
          ports: getOutputPorts(node),
          hasInput: def?.hasInput ?? true,
          status: statusByNode[node.id],
        },
      }
    })
  }, [workflow, selectedNodeId, statusByNode])

  const rfEdges: Edge[] = useMemo(() => {
    if (!workflow) return []
    return workflow.edges.map((edge) => {
      const source = workflow.nodes.find((n) => n.id === edge.source)
      const sourceDef = source ? getNodeDefinition(source.type) : undefined
      const isBranching = source?.type === 'condition' || source?.type === 'validate_input' || source?.type === 'switch'
      const portLabel = isBranching
        ? getOutputPorts(source!).find((p) => p.id === (edge.sourceHandle ?? 'out'))?.label
        : undefined
      const activeStatus = statusByNode[edge.source]
      const stroke = activeStatus === 'success' ? '#34e0b0' : activeStatus === 'failed' ? '#fb7185' : '#2b3a5c'
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? 'out',
        targetHandle: edge.targetHandle ?? 'in',
        type: 'smoothstep',
        animated: running,
        label: portLabel,
        labelBgPadding: [4, 2] as [number, number],
        style: { stroke, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 18, height: 18 },
      }
    })
  }, [workflow, statusByNode, running])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!workflowId) return
      applyNodeChanges(workflowId, changes)
    },
    [workflowId, applyNodeChanges],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (!workflowId) return
      applyEdgeChanges(workflowId, changes)
    },
    [workflowId, applyEdgeChanges],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!workflowId || !connection.source || !connection.target) return
      if (connection.source === connection.target) return
      addEdge(workflowId, {
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? 'out',
        targetHandle: connection.targetHandle ?? 'in',
      })
    },
    [workflowId, addEdge],
  )

  const handleAddNode = useCallback(
    (type: NodeType) => {
      if (!workflowId) return
      const position = screenToFlowPosition({
        x: (wrapperRef.current?.clientWidth ?? 800) / 2 + (Math.random() * 80 - 40),
        y: 160 + Math.random() * 60,
      })
      const node = addNode(workflowId, type, position)
      if (node) {
        setSelectedNodeId(node.id)
        setRightTab('node')
      }
    },
    [workflowId, addNode, screenToFlowPosition],
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      if (!workflowId) return
      const type = event.dataTransfer.getData(NODE_DRAG_TYPE) as NodeType
      if (!type) return
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const node = addNode(workflowId, type, { x: position.x - 110, y: position.y - 30 })
      if (node) {
        setSelectedNodeId(node.id)
        setRightTab('node')
      }
    },
    [workflowId, addNode, screenToFlowPosition],
  )

  const execute = useCallback(
    async (trigger: any) => {
      if (!workflow) return
      cancelRef.current = { aborted: false }
      setRunOpen(false)
      setRunning(true)
      setRightTab('execution')
      try {
        const execution = await runWorkflow(workflow, {
          trigger,
          source: 'manual',
          signal: cancelRef.current,
          onEvent: (event) => {
            if (event.type === 'start' || event.type === 'finish') {
              setLiveExecution(safeClone(event.execution))
            } else {
              setLiveExecution(safeClone(event.execution))
            }
          },
        })
        recordExecution(execution)
        setLiveExecution(execution)
      } finally {
        setRunning(false)
      }
    },
    [workflow, recordExecution],
  )

  const cancelRun = () => {
    cancelRef.current.aborted = true
  }

  if (!workflow) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-ink-300">This workflow no longer exists.</p>
        <Button variant="primary" onClick={() => navigate('/')}>
          <Icon name="ArrowLeft" size={15} /> Back to dashboard
        </Button>
      </div>
    )
  }

  const nodeStatus = running ? 'running' : validation.valid ? 'valid' : 'invalid'

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700/70 bg-ink-900/70 px-3 py-2">
        <Link
          to="/"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 hover:bg-ink-800 hover:text-white"
          title="Back to dashboard"
        >
          <Icon name="ArrowLeft" size={17} />
        </Link>

        <input
          value={workflow.name}
          onChange={(e) => renameWorkflow(workflow.id, e.target.value)}
          className="min-w-[160px] max-w-xs flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-semibold text-white hover:border-ink-600 focus:border-accent-500 focus:bg-ink-900 focus:outline-none"
        />

        <Badge tone="neutral">{workflow.nodes.length} nodes</Badge>
        <Badge tone="neutral">{workflow.edges.length} connections</Badge>
        <Badge tone={validation.valid ? 'mint' : 'rose'}>
          <Icon name={validation.valid ? 'ShieldCheck' : 'AlertTriangle'} size={12} />
          {validation.valid ? 'Valid' : `${validation.errors.length} error${validation.errors.length === 1 ? '' : 's'}`}
        </Badge>
        <span className="hidden items-center gap-1 text-[11px] text-ink-500 sm:flex">
          <Icon name="Check" size={12} /> saved {timeAgo(workflow.updatedAt)}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRightTab('validation')}
            title="Show validation results"
          >
            <Icon name="ShieldCheck" size={15} /> Validate
          </Button>
          {running ? (
            <Button size="sm" variant="danger" onClick={cancelRun}>
              <Icon name="X" size={15} /> Cancel run
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setRunOpen(true)}
              disabled={!validation.valid}
              title={validation.valid ? 'Run this workflow' : 'Fix validation errors first'}
            >
              <Icon name="Play" size={15} /> Run
            </Button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Palette */}
        <div className="hidden w-64 shrink-0 border-r border-ink-700/70 bg-ink-900/40 md:block">
          <NodePalette onAdd={handleAddNode} />
        </div>

        {/* Canvas */}
        <div ref={wrapperRef} className="relative min-w-0 flex-1" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id)
              setRightTab('node')
            }}
            onPaneClick={() => setSelectedNodeId(null)}
            onNodeDragStart={() => setRightTab('node')}
            deleteKeyCode={['Backspace', 'Delete']}
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ type: 'smoothstep' }}
            className="bg-ink-950/40"
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#1e2942" />
            <Controls className="!rounded-lg !border !border-ink-700 !bg-ink-800" showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => {
                const category = (node.data as any)?.category
                const colors: Record<string, string> = {
                  trigger: '#34e0b0',
                  data: '#6ea8ff',
                  logic: '#b07cff',
                  action: '#fbbf24',
                  ai: '#f472b6',
                }
                return colors[category] ?? '#6b7ba8'
              }}
              maskColor="rgba(7,10,18,0.7)"
              className="!rounded-lg"
            />
          </ReactFlow>

          {workflow.nodes.length === 1 && (
            <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-xl border border-ink-700 bg-ink-850/95 px-4 py-3 text-center shadow-xl">
              <p className="text-xs font-medium text-white">Add your first step</p>
              <p className="mt-0.5 text-[11px] text-ink-400">
                Drag a node from the left, or click one to add it, then connect the handles.
              </p>
            </div>
          )}

          {running && (
            <div className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-accent-500/40 bg-accent-500/15 px-3 py-1.5 text-xs text-accent-200 shadow-lg backdrop-blur">
              <Icon name="Loader2" size={14} className="animate-spin" /> Running workflow…
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="flex w-[340px] shrink-0 flex-col border-l border-ink-700/70 bg-ink-900/40">
          <div className="flex gap-1 border-b border-ink-700/70 px-2 pt-2">
            <TabButton active={rightTab === 'node'} onClick={() => setRightTab('node')} disabled={!selectedNode}>
              Configure
            </TabButton>
            <TabButton active={rightTab === 'validation'} onClick={() => setRightTab('validation')}>
              Validate
              {!validation.valid && <span className="ml-1 text-rose-300">•</span>}
            </TabButton>
            <TabButton active={rightTab === 'execution'} onClick={() => setRightTab('execution')}>
              Run
            </TabButton>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {rightTab === 'node' &&
              (selectedNode ? (
                <ConfigPanel
                  node={selectedNode}
                  onChange={(config) => updateNodeConfig(workflow.id, selectedNode.id, config)}
                  onRename={(name) => renameNode(workflow.id, selectedNode.id, name)}
                  onToggleDisabled={() => toggleNodeDisabled(workflow.id, selectedNode.id)}
                  onDuplicate={() => duplicateNode(workflow.id, selectedNode.id)}
                  onDelete={() => {
                    removeNode(workflow.id, selectedNode.id)
                    setSelectedNodeId(null)
                  }}
                />
              ) : (
                <div className="p-6 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800 text-ink-400">
                    <Icon name="Crosshair" size={20} />
                  </div>
                  <p className="text-sm font-medium text-white">No node selected</p>
                  <p className="mt-1 text-xs text-ink-400">Click a node on the canvas to edit its settings.</p>
                </div>
              ))}

            {rightTab === 'validation' && (
              <div className="h-full overflow-y-auto">
                <ValidationPanel
                  result={validation}
                  onSelectNode={(nodeId) => {
                    setSelectedNodeId(nodeId)
                    setRightTab('node')
                  }}
                />
              </div>
            )}

            {rightTab === 'execution' && (
              <div className="h-full overflow-hidden">
                <ExecutionPanel
                  execution={displayedExecution}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={(nodeId) => {
                    setSelectedNodeId(nodeId)
                    setRightTab('node')
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <RunDialog
        open={runOpen}
        workflow={workflow}
        onClose={() => setRunOpen(false)}
        onRun={execute}
        running={running}
      />
    </div>
  )
}

function TabButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex-1 rounded-t-md px-2 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-ink-800 text-white' : 'text-ink-400 hover:text-ink-200',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {children}
    </button>
  )
}
