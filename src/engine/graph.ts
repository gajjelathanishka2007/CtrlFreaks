import type { WorkflowEdge, WorkflowNode } from '../types/workflow'

export interface GraphIndex {
  nodeById: Map<string, WorkflowNode>
  incoming: Map<string, WorkflowEdge[]>
  outgoing: Map<string, WorkflowEdge[]>
}

/** Build lookup maps for a workflow graph. */
export function buildIndex(nodes: WorkflowNode[], edges: WorkflowEdge[]): GraphIndex {
  const nodeById = new Map<string, WorkflowNode>()
  const incoming = new Map<string, WorkflowEdge[]>()
  const outgoing = new Map<string, WorkflowEdge[]>()

  for (const node of nodes) {
    nodeById.set(node.id, node)
    incoming.set(node.id, [])
    outgoing.set(node.id, [])
  }

  for (const edge of edges) {
    // Ignore edges that reference unknown nodes so a half-built graph never
    // crashes the engine — validation reports these separately.
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue
    outgoing.get(edge.source)!.push(edge)
    incoming.get(edge.target)!.push(edge)
  }

  return { nodeById, incoming, outgoing }
}

export interface TopoResult {
  order: string[]
  hasCycle: boolean
  /** Nodes that remain unresolved when a cycle is present. */
  cycleNodes: string[]
}

/**
 * Kahn's algorithm. Returns nodes in dependency order. When a cycle is present
 * the unresolved nodes are returned in `cycleNodes`.
 */
export function topoSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): TopoResult {
  const { nodeById, incoming, outgoing } = buildIndex(nodes, edges)
  const indegree = new Map<string, number>()

  for (const node of nodes) {
    // Only count edges between known nodes.
    const deg = incoming.get(node.id)!.filter((e) => nodeById.has(e.source)).length
    indegree.set(node.id, deg)
  }

  const queue: string[] = []
  for (const node of nodes) if ((indegree.get(node.id) ?? 0) === 0) queue.push(node.id)

  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const edge of outgoing.get(id) ?? []) {
      if (!nodeById.has(edge.target)) continue
      const next = (indegree.get(edge.target) ?? 0) - 1
      indegree.set(edge.target, next)
      if (next === 0) queue.push(edge.target)
    }
  }

  const hasCycle = order.length !== nodes.length
  const cycleNodes = hasCycle ? nodes.filter((n) => !order.includes(n.id)).map((n) => n.id) : []
  return { order, hasCycle, cycleNodes }
}

/** Node ids reachable from the given roots by following edges forward. */
export function reachableFrom(
  rootIds: string[],
  edges: WorkflowEdge[],
  nodes: WorkflowNode[],
): Set<string> {
  const adjacency = new Map<string, string[]>()
  const known = new Set(nodes.map((n) => n.id))
  for (const e of edges) {
    if (!known.has(e.source) || !known.has(e.target)) continue
    if (!adjacency.has(e.source)) adjacency.set(e.source, [])
    adjacency.get(e.source)!.push(e.target)
  }

  const seen = new Set<string>()
  const stack = [...rootIds]
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    for (const next of adjacency.get(id) ?? []) stack.push(next)
  }
  return seen
}
