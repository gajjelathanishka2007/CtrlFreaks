import type { NodeType, WorkflowNode } from '../types/workflow'

/** Status shared by executions and individual node runs. */
export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'cancelled'

export type LogLevel = 'info' | 'success' | 'warn' | 'error'

export interface LogEntry {
  ts: number
  level: LogLevel
  message: string
  nodeId?: string
  nodeName?: string
}

export interface NotificationRecord {
  ts: number
  channel: string
  to: string
  subject: string
  body: string
  /** 'demo' when delivered by the built-in adapter. */
  transport: 'demo' | 'live'
}

export interface NodeExecutionResult {
  nodeId: string
  nodeName: string
  nodeType: NodeType
  status: ExecutionStatus
  startedAt: number
  finishedAt?: number
  durationMs?: number
  input?: any
  output?: any
  error?: string
  /** For branching nodes: which port was selected. */
  branch?: string
  skippedReason?: string
}

/**
 * Shared mutable context for a single workflow execution.
 * A fresh context is created for every run so data can never leak between
 * separate executions.
 */
export interface ExecutionContext {
  workflowId: string
  workflowName: string
  executionId: string
  /** The payload handed to the trigger node. */
  trigger: any
  /** nodeId -> output of that node, available to later nodes. */
  outputs: Record<string, any>
  /** Key/value store written by "Save Result" nodes. */
  saved: Record<string, any>
  logs: LogEntry[]
  notifications: NotificationRecord[]
  /** Set to true to cooperatively cancel a running execution. */
  aborted: boolean
  /** Guards against runaway/expensive AI calls. */
  aiCalls: number
}

export interface NodeExecArgs {
  node: WorkflowNode
  config: any
  /** Merged output of the node's upstream (active) predecessors. */
  input: any
  context: ExecutionContext
  executionId: string
  /** Template resolver bound to this node's context and input. */
  resolve: (template: unknown) => any
  signal: { aborted: boolean }
}

export interface NodeExecResult {
  output: any
  /** Which output port to follow ('out' by default, or 'true'/'false'/…). */
  branch?: string
  logs?: Omit<LogEntry, 'ts'>[]
  warnings?: string[]
}

/** Node handlers implement this contract. */
export interface NodeDefinition<C = any> {
  type: NodeType
  label: string
  category: NodeCategoryLocal
  description: string
  /** lucide-react icon name (see components/NodeIcon). */
  icon: string
  /** Defaults used when a node is created. */
  defaultConfig: C
  /** Drives the generic configuration panel. */
  fields: FieldSpecLocal[]
  /** Static output ports. Switch nodes compute ports dynamically. */
  outputs: OutputPort[]
  /** Whether the node accepts an incoming connection. */
  hasInput: boolean
  /** Extra config validation beyond required-field checks. */
  validateConfig?: (config: C) => string[]
  /** True for nodes that behave like a trigger (no incoming data needed). */
  isTrigger?: boolean
  /** Node is demo-only and cannot reach a real external service. */
  demoOnly?: boolean
  execute: (args: NodeExecArgs) => Promise<NodeExecResult> | NodeExecResult
}

type NodeCategoryLocal = 'trigger' | 'data' | 'logic' | 'action' | 'ai'
type FieldSpecLocal = import('../types/workflow').FieldSpec
type OutputPort = { id: string; label: string }

export interface Execution {
  id: string
  workflowId: string
  workflowName: string
  status: ExecutionStatus
  trigger: any
  startedAt: number
  finishedAt?: number
  durationMs?: number
  nodeResults: NodeExecutionResult[]
  logs: LogEntry[]
  saved: Record<string, any>
  notifications: NotificationRecord[]
  error?: string
  /** 'manual' | 'webhook' | 'test' — kept for the history view. */
  source: 'manual' | 'webhook' | 'test'
}

export interface ValidationIssue {
  severity: 'error' | 'warning'
  code: string
  message: string
  nodeId?: string
  edgeId?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}
