import { getNodeDefinition } from '../engine/registry'
import type { WorkflowBlueprint } from './ai'
import type { NodeType, Workflow, WorkflowEdge, WorkflowNode } from '../types/workflow'
import { uid } from './utils'
import '../engine/nodes' // register handlers so defaults are available

export interface NodeSpec {
  type: NodeType
  name: string
  config?: Record<string, any>
}

export interface EdgeSpec {
  from: number
  port?: string
  to: number
}

/** The output port that continues the "happy path" for a node type. */
export function primaryPortForType(type: NodeType): string {
  switch (type) {
    case 'condition':
      return 'true'
    case 'validate_input':
      return 'valid'
    case 'switch':
      return 'case_0'
    default:
      return 'out'
  }
}

function clone<T>(value: T): T {
  try {
    return structuredClone(value)
  } catch {
    return JSON.parse(JSON.stringify(value))
  }
}

/** Build a node with sane defaults taken from the registry. */
export function createNode(type: NodeType, position: { x: number; y: number }, name?: string): WorkflowNode {
  const def = getNodeDefinition(type)
  return {
    id: uid('node'),
    type,
    name: name ?? def?.label ?? type,
    config: def ? clone(def.defaultConfig) : {},
    position,
  }
}

/**
 * Assemble a workflow from node/edge specs using a simple layered layout:
 * depth (distance from the trigger) drives the x axis, siblings stack on y.
 */
export function buildWorkflow(
  name: string,
  description: string,
  specs: NodeSpec[],
  edges: EdgeSpec[],
  id?: string,
): Workflow {
  const depth: number[] = specs.map(() => 0)
  for (let pass = 0; pass < specs.length; pass++) {
    let changed = false
    for (const edge of edges) {
      if (edge.from < 0 || edge.from >= specs.length || edge.to < 0 || edge.to >= specs.length) continue
      const candidate = depth[edge.from] + 1
      if (depth[edge.to] < candidate) {
        depth[edge.to] = candidate
        changed = true
      }
    }
    if (!changed) break
  }

  const rowByDepth = new Map<number, number>()
  const nodes: WorkflowNode[] = specs.map((spec, index) => {
    const d = depth[index]
    const row = rowByDepth.get(d) ?? 0
    rowByDepth.set(d, row + 1)
    const def = getNodeDefinition(spec.type)
    return {
      id: uid('node'),
      type: spec.type,
      name: spec.name || def?.label || spec.type,
      config: spec.config ? clone(spec.config) : def ? clone(def.defaultConfig) : {},
      position: { x: 80 + d * 280, y: 80 + row * 150 },
    }
  })

  const workflowEdges: WorkflowEdge[] = edges.map((edge) => ({
    id: uid('edge'),
    source: nodes[edge.from].id,
    sourceHandle: edge.port ?? primaryPortForType(specs[edge.from].type),
    target: nodes[edge.to].id,
    targetHandle: 'in',
  }))

  const now = Date.now()
  return {
    id: id ?? uid('wf'),
    name,
    description,
    version: 1,
    enabled: true,
    nodes,
    edges: workflowEdges,
    createdAt: now,
    updatedAt: now,
  }
}

/** Convert an AI/demo blueprint into a linear workflow. */
export function blueprintToWorkflow(bp: WorkflowBlueprint): Workflow {
  const specs: NodeSpec[] = bp.steps.map((s) => ({ type: s.type, name: s.name, config: s.config }))
  const edges: EdgeSpec[] = []
  for (let i = 0; i < specs.length - 1; i++) edges.push({ from: i, to: i + 1 })
  return buildWorkflow(bp.name, bp.description, specs, edges)
}
