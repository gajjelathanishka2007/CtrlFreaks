import type { NodeDefinition } from './types'
import type { NodeType, WorkflowNode } from '../types/workflow'

const registry = new Map<NodeType, NodeDefinition>()

/** Register a node handler. Importing a node module registers it as a side effect. */
export function registerNode(def: NodeDefinition): void {
  registry.set(def.type, def)
}

export function getNodeDefinition(type: NodeType): NodeDefinition | undefined {
  return registry.get(type)
}

export function requireNodeDefinition(type: NodeType): NodeDefinition {
  const def = registry.get(type)
  if (!def) throw new Error(`Unsupported node type: "${type}"`)
  return def
}

export function isSupportedNodeType(type: string): type is NodeType {
  return registry.has(type as NodeType)
}

export function listNodeDefinitions(): NodeDefinition[] {
  const order: Record<string, number> = { trigger: 0, data: 1, logic: 2, action: 3, ai: 4 }
  return [...registry.values()].sort((a, b) => order[a.category] - order[b.category])
}

export interface OutputPort {
  id: string
  label: string
}

/**
 * Output ports for a node instance. Most nodes have a single 'out' port; a
 * Switch node's ports are derived from its configured cases.
 */
export function getOutputPorts(node: WorkflowNode): OutputPort[] {
  const def = getNodeDefinition(node.type)
  if (!def) return [{ id: 'out', label: 'Output' }]

  if (node.type === 'switch') {
    const cases: any[] = Array.isArray(node.config?.cases) ? node.config.cases : []
    const ports: OutputPort[] = cases.map((c, index) => ({
      id: `case_${index}`,
      label: c?.label || (c?.value ? String(c.value) : `Case ${index + 1}`),
    }))
    ports.push({
      id: 'default',
      label: node.config?.defaultLabel ? String(node.config.defaultLabel) : 'Default',
    })
    return ports
  }

  return def.outputs
}

export function getOutputPortIds(node: WorkflowNode): string[] {
  return getOutputPorts(node).map((p) => p.id)
}

/** Branching nodes choose a port at runtime. */
export function isBranchingNode(type: NodeType): boolean {
  return type === 'condition' || type === 'validate_input' || type === 'switch'
}
