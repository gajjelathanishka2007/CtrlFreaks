import { makeResolver, type ResolveScope } from './interpolate'
import { buildIndex, topoSort } from './graph'
import { getNodeDefinition, isBranchingNode } from './registry'
import { validateWorkflow } from './validation'
import { isPlainObject } from './nodes/helpers'
import type {
  Execution,
  ExecutionContext,
  ExecutionStatus,
  LogEntry,
  NodeExecutionResult,
} from './types'
import type { Workflow } from '../types/workflow'
import './nodes'

export interface RunOptions {
  /** Payload handed to the trigger node. */
  trigger?: any
  source?: 'manual' | 'webhook' | 'test'
  /** Called for live UI updates; receives the (mutable) execution snapshot. */
  onEvent?: (event: RunEvent) => void
  /**
   * Cooperative cancellation handle. Set `aborted = true` to stop between
   * nodes. The same object is passed to nodes as their abort signal.
   */
  signal?: { aborted: boolean }
}

export type RunEvent =
  | { type: 'start'; execution: Execution }
  | { type: 'node'; execution: Execution; result: NodeExecutionResult }
  | { type: 'log'; execution: Execution; log: LogEntry }
  | { type: 'finish'; execution: Execution }

function newId(prefix: string): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return `${prefix}_${uuid.replace(/-/g, '').slice(0, 12)}`
}

function skipped(
  node: Workflow['nodes'][number],
  reason: string,
): NodeExecutionResult {
  const now = Date.now()
  const def = getNodeDefinition(node.type)
  return {
    nodeId: node.id,
    nodeName: node.name || def?.label || node.type,
    nodeType: node.type,
    status: 'skipped',
    startedAt: now,
    finishedAt: now,
    durationMs: 0,
    skippedReason: reason,
  }
}

export function createExecutionContext(workflow: Workflow, executionId: string, trigger: any): ExecutionContext {
  return {
    workflowId: workflow.id,
    workflowName: workflow.name,
    executionId,
    trigger: trigger ?? {},
    outputs: {},
    saved: {},
    logs: [],
    notifications: [],
    aborted: false,
    aiCalls: 0,
  }
}

/**
 * Execute a workflow and return a complete execution record.
 *
 * The engine:
 *  1. validates the workflow,
 *  2. walks the graph in topological (dependency) order,
 *  3. only runs a node when at least one active upstream branch reaches it,
 *  4. evaluates branches for condition / validate / switch nodes,
 *  5. records node-level results, logs and saved values.
 */
export async function runWorkflow(workflow: Workflow, options: RunOptions = {}): Promise<Execution> {
  const executionId = newId('exec')
  const startedAt = Date.now()

  const context = createExecutionContext(workflow, executionId, options.trigger)
  const execution: Execution = {
    id: executionId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: 'running',
    trigger: context.trigger,
    startedAt,
    nodeResults: [],
    logs: context.logs,
    saved: context.saved,
    notifications: context.notifications,
    source: options.source ?? 'manual',
  }

  const emit = (event: RunEvent) => options.onEvent?.(event)

  emit({ type: 'start', execution })

  // ---- 1. Validate ------------------------------------------------------
  const validation = validateWorkflow(workflow)
  if (!validation.valid) {
    const message = validation.errors.map((e) => e.message).join(' ')
    execution.status = 'failed'
    execution.error = `Validation failed: ${message}`
    execution.finishedAt = Date.now()
    execution.durationMs = execution.finishedAt - startedAt
    context.logs.push({ ts: Date.now(), level: 'error', message: execution.error })
    emit({ type: 'finish', execution })
    return execution
  }

  const nodes = workflow.nodes
  const edges = workflow.edges
  const { nodeById, incoming, outgoing } = buildIndex(nodes, edges)
  const topo = topoSort(nodes, edges)

  const activeEdges = new Set<string>()
  const statusById = new Map<string, ExecutionStatus>()
  const resultById = new Map<string, NodeExecutionResult>()

  let halted = false
  let firstError: string | undefined

  // ---- 2. Execute in dependency order ----------------------------------
  for (const nodeId of topo.order) {
    const node = nodeById.get(nodeId)
    if (!node) continue

    if (context.aborted || halted) {
      statusById.set(nodeId, 'skipped')
      const record = skipped(node, context.aborted ? 'Execution was cancelled.' : 'An earlier step failed.')
      resultById.set(nodeId, record)
      execution.nodeResults.push(record)
      continue
    }

    const def = getNodeDefinition(node.type)
    if (!def) {
      statusById.set(nodeId, 'skipped')
      const record = skipped(node, `Unsupported node type "${node.type}".`)
      resultById.set(nodeId, record)
      execution.nodeResults.push(record)
      continue
    }

    const incomingEdges = incoming.get(nodeId) ?? []
    const activeIncoming = incomingEdges.filter((e) => activeEdges.has(e.id))
    const isTrigger = def.isTrigger === true

    if (node.disabled) {
      statusById.set(nodeId, 'skipped')
      const record = skipped(node, 'Node is disabled.')
      resultById.set(nodeId, record)
      execution.nodeResults.push(record)
      continue
    }

    if (!isTrigger && activeIncoming.length === 0) {
      statusById.set(nodeId, 'skipped')
      const record = skipped(node, incomingEdges.length === 0 ? 'Not connected.' : 'No active upstream branch.')
      resultById.set(nodeId, record)
      execution.nodeResults.push(record)
      continue
    }

    // ---- Build the node input from active upstream outputs ------------
    let input: any
    if (isTrigger) {
      input = context.trigger ?? {}
    } else if (activeIncoming.length === 1) {
      input = context.outputs[activeIncoming[0].source]
    } else {
      const bySource: Record<string, any> = {}
      for (const edge of activeIncoming) bySource[edge.source] = context.outputs[edge.source]
      const allObjects = activeIncoming.every((e) => isPlainObject(context.outputs[e.source]))
      input = allObjects
        ? { ...Object.assign({}, ...activeIncoming.map((e) => context.outputs[e.source])), _inputs: bySource }
        : { _inputs: bySource }
    }

    const nodeStartedAt = Date.now()
    const result: NodeExecutionResult = {
      nodeId,
      nodeName: node.name || def.label,
      nodeType: node.type,
      status: 'running',
      startedAt: nodeStartedAt,
      input,
    }
    resultById.set(nodeId, result)
    execution.nodeResults.push(result)
    statusById.set(nodeId, 'running')
    emit({ type: 'node', execution, result })

    const scope: ResolveScope = {
      trigger: context.trigger,
      input,
      outputs: context.outputs,
      saved: context.saved,
      workflowId: workflow.id,
      workflowName: workflow.name,
      executionId,
    }
    const resolve = makeResolver(scope)

    try {
      const produced = await def.execute({
        node,
        config: node.config ?? {},
        input,
        context,
        executionId,
        resolve,
        signal: context,
      })

      for (const entry of produced.logs ?? []) {
        const log: LogEntry = { ts: Date.now(), nodeId, nodeName: result.nodeName, ...entry }
        context.logs.push(log)
        emit({ type: 'log', execution, log })
      }
      for (const message of produced.warnings ?? []) {
        const log: LogEntry = { ts: Date.now(), level: 'warn', nodeId, nodeName: result.nodeName, message }
        context.logs.push(log)
        emit({ type: 'log', execution, log })
      }

      context.outputs[nodeId] = produced.output
      result.output = produced.output
      result.branch = produced.branch ?? 'out'
      result.status = 'success'
      result.finishedAt = Date.now()
      result.durationMs = result.finishedAt - nodeStartedAt
      statusById.set(nodeId, 'success')

      // Activate the outgoing edge(s) that this result should follow.
      for (const edge of outgoing.get(nodeId) ?? []) {
        const handle = edge.sourceHandle ?? 'out'
        if (isBranchingNode(node.type)) {
          if (handle === result.branch) activeEdges.add(edge.id)
        } else {
          activeEdges.add(edge.id)
        }
      }

      emit({ type: 'node', execution, result })
    } catch (error: any) {
      const message = error?.message ?? 'Node execution failed.'
      result.status = 'failed'
      result.error = message
      result.finishedAt = Date.now()
      result.durationMs = result.finishedAt - nodeStartedAt
      statusById.set(nodeId, 'failed')
      const log: LogEntry = { ts: Date.now(), level: 'error', nodeId, nodeName: result.nodeName, message }
      context.logs.push(log)
      emit({ type: 'log', execution, log })
      emit({ type: 'node', execution, result })

      const continueOnError = node.config?.continueOnError === true
      if (!continueOnError) {
        halted = true
        firstError ??= `${result.nodeName}: ${message}`
      }
    }
  }

  // ---- 3. Finalize ------------------------------------------------------
  const anyFailed = execution.nodeResults.some((r) => r.status === 'failed')
  if (context.aborted) execution.status = 'cancelled'
  else if (anyFailed || halted) execution.status = 'failed'
  else execution.status = 'success'

  if (execution.status === 'failed') {
    execution.error = firstError ?? execution.nodeResults.find((r) => r.status === 'failed')?.error ?? 'Execution failed.'
  }

  execution.finishedAt = Date.now()
  execution.durationMs = execution.finishedAt - startedAt

  // Fill in any nodes that never got a result record (e.g. tree truncated).
  for (const node of nodes) {
    if (!resultById.has(node.id)) {
      const record = skipped(node, 'Did not run.')
      execution.nodeResults.push(record)
    }
  }
  execution.nodeResults.sort((a, b) => a.startedAt - b.startedAt)

  emit({ type: 'finish', execution })
  return execution
}
