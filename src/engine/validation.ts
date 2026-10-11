import { buildIndex, reachableFrom, topoSort } from './graph'
import { getNodeDefinition, getOutputPorts, isSupportedNodeType } from './registry'
import type { ValidationIssue, ValidationResult } from './types'
import type { NodeType, Workflow } from '../types/workflow'
import './nodes' // ensure the registry is populated

function label(node: { name?: string; type: string }): string {
  return node.name?.trim() || node.type
}

/**
 * Validates a workflow before it is executed or saved.
 *
 * Errors block execution. Warnings are surfaced to the user but do not block.
 */
export function validateWorkflow(workflow: Workflow | undefined | null): ValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const err = (code: string, message: string, extra: Partial<ValidationIssue> = {}) =>
    errors.push({ severity: 'error', code, message, ...extra })
  const warn = (code: string, message: string, extra: Partial<ValidationIssue> = {}) =>
    warnings.push({ severity: 'warning', code, message, ...extra })

  if (!workflow) {
    err('no_workflow', 'There is no workflow to validate.')
    return { valid: false, errors, warnings }
  }

  if (!workflow.id) err('no_id', 'The workflow is missing an id.')
  if (!workflow.name || !workflow.name.trim()) err('no_name', 'The workflow needs a name.')

  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : []
  const edges = Array.isArray(workflow.edges) ? workflow.edges : []

  if (nodes.length === 0) {
    err('no_nodes', 'The workflow has no nodes. Add a trigger and at least one step.')
    return { valid: false, errors, warnings }
  }

  // --- Nodes -------------------------------------------------------------
  const seenNodeIds = new Set<string>()
  for (const node of nodes) {
    if (!node.id) {
      err('node_missing_id', 'A node is missing its id.')
      continue
    }
    if (seenNodeIds.has(node.id)) err('node_duplicate_id', `Duplicate node id "${node.id}".`, { nodeId: node.id })
    seenNodeIds.add(node.id)

    if (!node.type) {
      err('node_missing_type', `Node "${label(node)}" has no type.`, { nodeId: node.id })
      continue
    }
    if (!isSupportedNodeType(node.type)) {
      err('node_unsupported', `Node "${label(node)}" uses an unsupported type "${node.type}".`, { nodeId: node.id })
      continue
    }
    if (!node.name || !node.name.trim()) {
      warn('node_no_name', `A ${node.type} node has no name. Consider giving it a clear label.`, { nodeId: node.id })
    }

    const def = getNodeDefinition(node.type)
    if (def?.validateConfig) {
      for (const message of def.validateConfig(node.config ?? {})) {
        err('node_config', `${label(node)}: ${message}`, { nodeId: node.id })
      }
    }
  }

  // --- Edges -------------------------------------------------------------
  const seenEdgeIds = new Set<string>()
  const nodeIds = new Set(nodes.map((n) => n.id))
  for (const edge of edges) {
    if (!edge.id) err('edge_missing_id', 'A connection is missing its id.')
    else if (seenEdgeIds.has(edge.id)) err('edge_duplicate_id', `Duplicate connection id "${edge.id}".`, { edgeId: edge.id })
    else seenEdgeIds.add(edge.id)

    if (!nodeIds.has(edge.source)) {
      err('edge_bad_source', `A connection starts from a node that does not exist ("${edge.source}").`, { edgeId: edge.id })
    }
    if (!nodeIds.has(edge.target)) {
      err('edge_bad_target', `A connection points to a node that does not exist ("${edge.target}").`, { edgeId: edge.id })
    }
    if (edge.source === edge.target) {
      err('edge_self', `Node "${label(nodeByIdMap(nodes, edge.source))}" is connected to itself.`, { edgeId: edge.id })
    }
  }

  // --- Triggers ----------------------------------------------------------
  const triggers = nodes.filter((n) => {
    if (!isSupportedNodeType(n.type)) return false
    return getNodeDefinition(n.type)?.isTrigger === true
  })

  if (triggers.length === 0) {
    err('no_trigger', 'Add a trigger node (for example a Manual Trigger) to start the workflow.')
  } else if (triggers.length > 1) {
    err(
      'multiple_triggers',
      `Found ${triggers.length} trigger nodes. This engine runs one trigger per workflow.`,
      { nodeId: triggers[1]?.id },
    )
  }

  const { incoming } = buildIndex(nodes, edges)
  for (const trigger of triggers) {
    if ((incoming.get(trigger.id) ?? []).length > 0) {
      err('trigger_has_input', `Trigger "${label(trigger)}" must not have incoming connections.`, { nodeId: trigger.id })
    }
  }

  // Dangling / unreachable non-trigger nodes.
  for (const node of nodes) {
    if (!isSupportedNodeType(node.type)) continue
    const def = getNodeDefinition(node.type)
    if (def?.isTrigger) continue
    if ((incoming.get(node.id) ?? []).length === 0) {
      err('node_no_input', `"${label(node)}" has no incoming connection, so it can never run.`, { nodeId: node.id })
    }
  }

  // --- Cycles ------------------------------------------------------------
  const topo = topoSort(nodes, edges)
  if (topo.hasCycle) {
    const names = topo.cycleNodes.map((id) => label(nodeByIdMap(nodes, id))).join(', ')
    err('cycle', `The workflow contains a loop (${names}). Loops are not supported yet.`, {
      nodeId: topo.cycleNodes[0],
    })
  }

  // --- Reachability from the trigger ------------------------------------
  if (triggers.length === 1) {
    const reachable = reachableFrom([triggers[0].id], edges, nodes)
    for (const node of nodes) {
      if (!reachable.has(node.id) && node.id !== triggers[0].id) {
        warn('unreachable', `"${label(node)}" is not connected to the trigger and will be skipped.`, {
          nodeId: node.id,
        })
      }
    }
  }

  // --- Branch coverage (warnings only) ----------------------------------
  for (const node of nodes) {
    if (!isSupportedNodeType(node.type)) continue
    const def = getNodeDefinition(node.type)
    if (!def || (!def.isTrigger && def.type !== 'switch')) {
      // fall through for switch handled next
    }
    const ports = getOutputPorts(node)
    if (ports.length <= 1) continue
    const { outgoing } = buildIndex(nodes, edges)
    const used = new Set((outgoing.get(node.id) ?? []).map((e) => e.sourceHandle ?? 'out'))
    for (const port of ports) {
      if (!used.has(port.id)) {
        warn('branch_unconnected', `"${label(node)}" has an unconnected "${port.label}" branch.`, { nodeId: node.id })
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

function nodeByIdMap(nodes: Workflow['nodes'], id: string) {
  return nodes.find((n) => n.id === id) ?? ({ name: id, type: 'unknown' } as any)
}

/** Convenience: the primary output port id for a node type. */
export function primaryPortFor(type: NodeType): string {
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
