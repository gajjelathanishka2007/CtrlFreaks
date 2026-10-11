import { useCallback, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus, MousePointerClick } from 'lucide-react'
import { nodeTypes } from './nodeTypes.js'
import BottomToolbar from './BottomToolbar.jsx'
import AddNodePopover from '../integrations/AddNodePopover.jsx'
import { ACCENTS, getNodeDef } from '../../data/nodeCatalog.js'

export default function WorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeDragStart,
  onSelectionChange,
  onAddNode,
  onSimulate,
  onDiagnostics,
  diagnosticsCount = 0,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  ready = true,
}) {
  const { screenToFlowPosition, fitView } = useReactFlow()
  const wrapperRef = useRef(null)
  const [addOpen, setAddOpen] = useState(false)

  const handleSelectDef = useCallback(
    (def) => {
      const rect = wrapperRef.current?.getBoundingClientRect()
      const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
      const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
      const jitterX = (Math.random() - 0.5) * 90
      const jitterY = (Math.random() - 0.5) * 90
      const position = screenToFlowPosition({ x: cx + jitterX, y: cy + jitterY })
      onAddNode(def, position)
      setAddOpen(false)
    },
    [onAddNode, screenToFlowPosition],
  )

  return (
    <div ref={wrapperRef} className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={onNodeDragStart}
        onSelectionChange={({ nodes: sel }) => onSelectionChange?.(sel?.[0]?.id ?? null)}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={['Delete', 'Backspace']}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ style: { stroke: '#19E68C', strokeWidth: 2 }, animated: false }}
        connectionLineStyle={{ stroke: '#19E68C', strokeWidth: 2 }}
        className="synq-canvas-grid"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#262c35" />
        <Controls
          position="bottom-left"
          showInteractive={false}
          className="!mb-4 !ml-4"
        />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          className="!mb-4 !mr-4"
          style={{ background: '#0d1014', width: 150, height: 100 }}
          maskColor="rgba(9,11,13,0.7)"
          nodeColor={(n) => ACCENTS[getNodeDef(n)?.accent]?.hex || '#3B82F6'}
        />

        <Panel position="top-left" className="!m-0 !mt-4 !ml-4">
          <div className="flex items-center gap-2 rounded-xl border border-edge bg-elevated/90 px-3 py-1.5 text-[11px] text-muted backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-neon" />
            {ready
              ? `${nodes.length} node${nodes.length === 1 ? '' : 's'} · ${edges.length} connection${
                  edges.length === 1 ? '' : 's'
                }`
              : 'Loading…'}
          </div>
        </Panel>

        {/* Empty state */}
        {ready && nodes.length === 0 && (
          <Panel position="top-center" className="!mt-24">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-edge bg-card/80 px-8 py-8 text-center backdrop-blur">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-neon/40 bg-neon/10 text-neon">
                <MousePointerClick size={22} />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">This canvas is empty</p>
                <p className="mt-1 text-xs text-muted">Use the + button below to add your first node.</p>
              </div>
              <button
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neon/50 bg-neon/12 px-3 py-1.5 text-xs font-medium text-neon transition hover:bg-neon/20"
              >
                <Plus size={14} /> Add Node / Integration
              </button>
            </div>
          </Panel>
        )}

        <BottomToolbar
          onAdd={() => setAddOpen((v) => !v)}
          addOpen={addOpen}
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          onFit={() => fitView({ padding: 0.25, duration: 300 })}
          onSimulate={onSimulate}
          onDiagnostics={onDiagnostics}
          diagnosticsCount={diagnosticsCount}
        />
      </ReactFlow>

      <AddNodePopover open={addOpen} onClose={() => setAddOpen(false)} onSelect={handleSelectDef} />
    </div>
  )
}
