/**
 * CtrlFreaks core domain types.
 *
 * A workflow is a directed graph of nodes. Each node has a stable id, a
 * supported `type`, a human readable `name`, and a free-form `config` object
 * whose shape is defined by the node's registry definition.
 */

export type NodeCategory = 'trigger' | 'data' | 'logic' | 'action' | 'ai'

export type NodeType =
  | 'manual_trigger'
  | 'webhook_trigger'
  | 'set_value'
  | 'transform'
  | 'validate_input'
  | 'log_output'
  | 'condition'
  | 'switch'
  | 'http_request'
  | 'save_result'
  | 'notify'
  | 'ai_transform'

export interface XYPosition {
  x: number
  y: number
}

export interface WorkflowNode {
  id: string
  type: NodeType
  name: string
  config: Record<string, any>
  position: XYPosition
  /** Disabled nodes are skipped at runtime but kept in the graph. */
  disabled?: boolean
}

export interface WorkflowEdge {
  id: string
  source: string
  /** Which output port the edge leaves from ('out', 'true', 'false', 'case_0'…). */
  sourceHandle?: string | null
  target: string
  /** All regular nodes expose a single input port named 'in'. */
  targetHandle?: string | null
  label?: string
}

export interface Workflow {
  id: string
  name: string
  description?: string
  version: number
  /** When false, the workflow is kept but marked inactive on the dashboard. */
  enabled: boolean
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  createdAt: number
  updatedAt: number
}

/** A field spec the generic config panel knows how to render. */
export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'json'
  | 'keyvalue'
  | 'conditionRules'
  | 'transformFields'
  | 'validateRules'
  | 'switchCases'

export interface FieldSpec {
  key: string
  label: string
  type: FieldType
  help?: string
  placeholder?: string
  /** Only for `select`. */
  options?: { value: string; label: string }[]
  /** Render the field across the full width of the panel. */
  wide?: boolean
}
