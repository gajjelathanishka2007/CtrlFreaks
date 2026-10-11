import { useCallback, useEffect, useRef, useState } from 'react'
import { addEdge, useNodesState, useEdgesState } from '@xyflow/react'
import { uid } from '../../utils/id.js'
import { getNodeDef } from '../../data/nodeCatalog.js'

const clone = (v) => JSON.parse(JSON.stringify(v ?? null))
const MAX_HISTORY = 60

/**
 * Owns the React Flow graph for one workflow: nodes, edges, selection,
 * undo/redo, and all mutations (add / update / delete / connect).
 */
export default function useWorkflowGraph(initialGraph) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialGraph?.nodes || [])
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph?.edges || [])
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [dirty, setDirty] = useState(false)

  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  const past = useRef([])
  const future = useRef([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const syncFlags = useCallback(() => {
    setCanUndo(past.current.length > 0)
    setCanRedo(future.current.length > 0)
  }, [])

  const takeSnapshot = useCallback(() => {
    past.current = [...past.current.slice(-(MAX_HISTORY - 1)), { nodes: clone(nodesRef.current), edges: clone(edgesRef.current) }]
    future.current = []
    syncFlags()
  }, [syncFlags])

  /** Replace the whole graph (e.g. loading a different workflow). */
  const resetGraph = useCallback(
    (graph) => {
      past.current = []
      future.current = []
      syncFlags()
      setNodes(clone(graph?.nodes || []))
      setEdges(clone(graph?.edges || []))
      setSelectedNodeId(null)
      setDirty(false)
    },
    [setNodes, setEdges, syncFlags],
  )

  const undo = useCallback(() => {
    if (!past.current.length) return
    const prev = past.current.pop()
    future.current.push({ nodes: clone(nodesRef.current), edges: clone(edgesRef.current) })
    setNodes(prev.nodes)
    setEdges(prev.edges)
    setDirty(true)
    syncFlags()
  }, [setNodes, setEdges, syncFlags])

  const redo = useCallback(() => {
    if (!future.current.length) return
    const next = future.current.pop()
    past.current.push({ nodes: clone(nodesRef.current), edges: clone(edgesRef.current) })
    setNodes(next.nodes)
    setEdges(next.edges)
    setDirty(true)
    syncFlags()
  }, [setNodes, setEdges, syncFlags])

  /** Add a node from a catalog definition. Returns the new node id. */
  const addNode = useCallback(
    (def, position) => {
      const id = uid('n')
      takeSnapshot()
      setNodes((nds) => [
        ...nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
        {
          id,
          type: def.type,
          position,
          selected: true,
          data: {
            catalogId: def.id,
            label: def.name,
            config: clone(def.defaultConfig || {}),
            _defId: def.id,
          },
        },
      ])
      setSelectedNodeId(id)
      setDirty(true)
      return id
    },
    [setNodes, takeSnapshot],
  )

  const updateNodeData = useCallback(
    (id, patch, { snapshot = true } = {}) => {
      if (snapshot) takeSnapshot()
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
      setDirty(true)
    },
    [setNodes, takeSnapshot],
  )

  const deleteNode = useCallback(
    (id) => {
      takeSnapshot()
      setNodes((nds) => nds.filter((n) => n.id !== id))
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
      setSelectedNodeId((cur) => (cur === id ? null : cur))
      setDirty(true)
    },
    [setNodes, setEdges, takeSnapshot],
  )

  const connect = useCallback(
    (params) => {
      // Block self-loops and duplicate edges.
      if (params.source === params.target) return
      let duplicate = false
      for (const e of edgesRef.current) {
        if (e.source === params.source && e.target === params.target && e.sourceHandle === params.sourceHandle) {
          duplicate = true
          break
        }
      }
      if (duplicate) return
      takeSnapshot()
      setEdges((eds) =>
        addEdge({ ...params, id: uid('e'), animated: false, style: { stroke: '#19E68C' } }, eds),
      )
      setDirty(true)
    },
    [setEdges, takeSnapshot],
  )

  const onNodeDragStart = useCallback(() => {
    takeSnapshot()
  }, [takeSnapshot])

  const markSaved = useCallback(() => setDirty(false), [])

  const setSelected = useCallback((id) => setSelectedNodeId(id), [])

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    selectedNode,
    selectedNodeId,
    setSelected,
    selectedDef: selectedNode ? getNodeDef(selectedNode) : null,
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
  }
}
