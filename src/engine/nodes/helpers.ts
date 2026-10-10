import type { LogEntry, LogLevel } from '../types'

export function isPlainObject(value: any): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Branching nodes (condition / validate / switch) pass their upstream data
 * through unchanged and add `_branch` metadata so downstream nodes can still
 * reference the original fields with {{input.field}}.
 */
export function withBranchMeta(
  input: any,
  branch: string,
  extra: Record<string, any> = {},
): Record<string, any> {
  const base = isPlainObject(input) ? { ...input } : input === undefined ? {} : { value: input }
  return { ...base, _branch: branch, ...extra }
}

export type JsonParseResult =
  | { ok: true; value: any }
  | { ok: false; error: string }

export function safeJsonParse(text: unknown): JsonParseResult {
  if (text === undefined || text === null || text === '') return { ok: true, value: undefined }
  if (typeof text !== 'string') return { ok: true, value: text }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (error: any) {
    return { ok: false, error: error?.message ?? 'Invalid JSON' }
  }
}

export function line(level: LogLevel, message: string): Omit<LogEntry, 'ts'> {
  return { level, message }
}

export function toNumber(value: any): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : undefined
}

export function toBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    return !(v === '' || v === 'false' || v === '0' || v === 'no' || v === 'null' || v === 'undefined')
  }
  return Boolean(value)
}

export function isEmail(value: any): boolean {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** Field operations offered by the Transform node. */
export const TRANSFORM_OPS = [
  'none',
  'upper',
  'lower',
  'trim',
  'number',
  'round',
  'ceil',
  'floor',
  'abs',
  'string',
  'json',
  'boolean',
  'length',
  'default',
] as const

export type TransformOp = (typeof TRANSFORM_OPS)[number]

export function applyOp(value: any, op: TransformOp, fallback?: any): any {
  switch (op) {
    case 'upper':
      return String(value ?? '').toUpperCase()
    case 'lower':
      return String(value ?? '').toLowerCase()
    case 'trim':
      return String(value ?? '').trim()
    case 'number':
      return toNumber(value)
    case 'round':
      return Math.round(toNumber(value) ?? 0)
    case 'ceil':
      return Math.ceil(toNumber(value) ?? 0)
    case 'floor':
      return Math.floor(toNumber(value) ?? 0)
    case 'abs':
      return Math.abs(toNumber(value) ?? 0)
    case 'string':
      return isPlainObject(value) || Array.isArray(value) ? JSON.stringify(value) : String(value ?? '')
    case 'json': {
      if (typeof value !== 'string') return value
      const parsed = safeJsonParse(value)
      return parsed.ok ? parsed.value : value
    }
    case 'boolean':
      return toBoolean(value)
    case 'length': {
      if (typeof value === 'string' || Array.isArray(value)) return value.length
      if (isPlainObject(value)) return Object.keys(value).length
      return 0
    }
    case 'default':
      return value === undefined || value === null || value === '' ? fallback ?? null : value
    case 'none':
    default:
      return value
  }
}

export const CONDITION_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'notEquals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'notContains', label: 'does not contain' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'endsWith', label: 'ends with' },
  { value: 'greaterThan', label: 'greater than' },
  { value: 'greaterThanOrEqual', label: 'greater than or equal' },
  { value: 'lessThan', label: 'less than' },
  { value: 'lessThanOrEqual', label: 'less than or equal' },
  { value: 'isTruthy', label: 'is truthy' },
  { value: 'isFalsy', label: 'is falsy' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' },
  { value: 'regex', label: 'matches regex' },
]

/** Evaluate a single condition rule. */
export function evaluateOperator(operator: string, left: any, right: any): boolean {
  switch (operator) {
    case 'equals':
      // Loose comparison so "5" equals 5, which is what beginners expect.
      return String(left) === String(right)
    case 'notEquals':
      return String(left) !== String(right)
    case 'contains':
      return String(left ?? '').includes(String(right ?? ''))
    case 'notContains':
      return !String(left ?? '').includes(String(right ?? ''))
    case 'startsWith':
      return String(left ?? '').startsWith(String(right ?? ''))
    case 'endsWith':
      return String(left ?? '').endsWith(String(right ?? ''))
    case 'greaterThan':
      return (toNumber(left) ?? NaN) > (toNumber(right) ?? NaN)
    case 'greaterThanOrEqual':
      return (toNumber(left) ?? NaN) >= (toNumber(right) ?? NaN)
    case 'lessThan':
      return (toNumber(left) ?? NaN) < (toNumber(right) ?? NaN)
    case 'lessThanOrEqual':
      return (toNumber(left) ?? NaN) <= (toNumber(right) ?? NaN)
    case 'isTruthy':
      return toBoolean(left)
    case 'isFalsy':
      return !toBoolean(left)
    case 'isEmpty': {
      if (left === null || left === undefined) return true
      if (typeof left === 'string') return left.trim().length === 0
      if (Array.isArray(left)) return left.length === 0
      if (isPlainObject(left)) return Object.keys(left).length === 0
      return false
    }
    case 'isNotEmpty':
      return !evaluateOperator('isEmpty', left, right)
    case 'regex':
      try {
        return new RegExp(String(right ?? '')).test(String(left ?? ''))
      } catch {
        return false
      }
    default:
      return false
  }
}

/** Best-effort deep clone that never throws on odd values. */
export function safeClone<T>(value: T): T {
  if (value === undefined || value === null) return value
  try {
    return structuredClone(value)
  } catch {
    try {
      return JSON.parse(JSON.stringify(value))
    } catch {
      return value
    }
  }
}
