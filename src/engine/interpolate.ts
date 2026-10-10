/**
 * CtrlFreaks data-reference convention.
 *
 * Anywhere a config supports an input, you can reference runtime data with a
 * double-brace template. Supported roots:
 *
 *   {{trigger.someField}}        -> the payload passed to the trigger node
 *   {{input.someField}}          -> the merged output of the upstream node(s)
 *   {{node.<nodeId>.someField}}  -> output of a specific node
 *   {{<nodeId>.someField}}       -> shorthand for the above
 *   {{saved.<key>}}              -> a value written by a "Save Result" node
 *   {{workflow.id}} / {{workflow.name}}
 *   {{execution.id}}
 *   {{now}}                      -> current ISO timestamp
 *
 * If a whole string is a single expression (e.g. "{{input.total}}") the raw
 * typed value is returned. Otherwise placeholders are string-interpolated.
 */

export interface ResolveScope {
  trigger: any
  input: any
  outputs: Record<string, any>
  saved: Record<string, any>
  workflowId: string
  workflowName: string
  executionId: string
}

export function getByPath(source: any, path: string): any {
  if (!path) return source
  const segments = path.split('.').filter((s) => s.length > 0)
  let cursor = source
  for (const segment of segments) {
    if (cursor === null || cursor === undefined) return undefined
    cursor = cursor[segment]
  }
  return cursor
}

function resolveExpression(rawExpr: string, scope: ResolveScope): any {
  const expr = rawExpr.trim()
  if (!expr) return undefined

  const parts = expr.split('.')
  const root = parts[0]

  const special = (base: any, rest: string): any => (rest ? getByPath(base, rest) : base)

  switch (root) {
    case 'trigger':
      return special(scope.trigger, parts.slice(1).join('.'))
    case 'input':
      return special(scope.input, parts.slice(1).join('.'))
    case 'saved':
      return special(scope.saved, parts.slice(1).join('.'))
    case 'workflow':
      return special(
        { id: scope.workflowId, name: scope.workflowName },
        parts.slice(1).join('.'),
      )
    case 'execution':
      return special({ id: scope.executionId }, parts.slice(1).join('.'))
    case 'now':
      return new Date().toISOString()
    case 'node':
    case 'nodes': {
      const nodeId = parts[1]
      const rest = parts.slice(2).join('.')
      return special(nodeId ? scope.outputs[nodeId] : undefined, rest)
    }
    default:
      break
  }

  const rest = parts.slice(1).join('.')

  // Shorthand: {{<nodeId>.field}}
  if (Object.prototype.hasOwnProperty.call(scope.outputs, root)) {
    return special(scope.outputs[root], rest)
  }
  // Bare field of the direct input, then of the trigger payload.
  if (scope.input && typeof scope.input === 'object' && root in scope.input) {
    return special(scope.input, expr)
  }
  if (scope.trigger && typeof scope.trigger === 'object' && root in scope.trigger) {
    return special(scope.trigger, expr)
  }
  return undefined
}

const SINGLE_EXPR = /^\s*\{\{([\s\S]+)\}\}\s*$/
const ANY_EXPR = /\{\{([\s\S]+?)\}\}/g

function stringify(value: any): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/** Resolve a single string. Preserves types for whole-string expressions. */
export function resolveString(template: string, scope: ResolveScope): any {
  const single = SINGLE_EXPR.exec(template)
  if (single) return resolveExpression(single[1], scope)
  if (!template.includes('{{')) return template
  return template.replace(ANY_EXPR, (_m, expr) => stringify(resolveExpression(expr, scope)))
}

/**
 * Recursively resolve a value: strings get template treatment; arrays and
 * plain objects are walked; everything else is returned unchanged.
 */
export function resolveValue(template: any, scope: ResolveScope): any {
  if (typeof template === 'string') return resolveString(template, scope)
  if (Array.isArray(template)) return template.map((item) => resolveValue(item, scope))
  if (template && typeof template === 'object') {
    const out: Record<string, any> = {}
    for (const [key, value] of Object.entries(template)) out[key] = resolveValue(value, scope)
    return out
  }
  return template
}

/** Build a resolver bound to a scope. */
export function makeResolver(scope: ResolveScope) {
  return (template: unknown) => resolveValue(template, scope)
}
