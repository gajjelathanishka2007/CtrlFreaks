import { getByPath } from '../interpolate'
import { registerNode } from '../registry'
import type { NodeDefinition } from '../types'
import {
  applyOp,
  isEmail,
  isPlainObject,
  line,
  toNumber,
  withBranchMeta,
  type TransformOp,
} from './helpers'

interface KeyValue {
  key: string
  value: string
}

const setValue: NodeDefinition<{ fields: KeyValue[]; mergeInput: boolean }> = {
  type: 'set_value',
  label: 'Set Value',
  category: 'data',
  icon: 'PenLine',
  description: 'Creates or overwrites fields on the data object.',
  hasInput: true,
  defaultConfig: {
    fields: [
      { key: 'greeting', value: 'Hello {{input.name}}' },
      { key: 'processed', value: 'true' },
    ],
    mergeInput: true,
  },
  fields: [
    {
      key: 'fields',
      label: 'Fields to set',
      type: 'keyvalue',
      wide: true,
      help: 'Values support templates like {{input.name}} or {{trigger.id}}.',
    },
    { key: 'mergeInput', label: 'Keep upstream fields', type: 'boolean' },
  ],
  outputs: [{ id: 'out', label: 'Data' }],
  execute: ({ config, input, resolve }) => {
    const out: Record<string, any> = config?.mergeInput && isPlainObject(input) ? { ...input } : {}
    const fields: KeyValue[] = Array.isArray(config?.fields) ? config.fields : []
    for (const field of fields) {
      if (!field?.key) continue
      out[field.key] = resolve(field.value ?? '')
    }
    return {
      output: out,
      logs: [line('info', `Set ${fields.filter((f) => f?.key).length} field(s).`)],
    }
  },
  validateConfig: (config) => {
    const fields: KeyValue[] = Array.isArray(config?.fields) ? config.fields : []
    const errors: string[] = []
    if (fields.length === 0) errors.push('Add at least one field.')
    const seen = new Set<string>()
    for (const field of fields) {
      if (!field?.key) errors.push('Every field needs a name.')
      else if (seen.has(field.key)) errors.push(`Duplicate field name "${field.key}".`)
      else seen.add(field.key)
    }
    return errors
  },
}

interface TransformField {
  key: string
  value: string
  op?: TransformOp
  fallback?: string
}

const transform: NodeDefinition<{ fields: TransformField[]; includeInput: boolean }> = {
  type: 'transform',
  label: 'Transform Data',
  category: 'data',
  icon: 'Wand2',
  description: 'Maps upstream data into a new shape and applies operations like uppercase or round.',
  hasInput: true,
  defaultConfig: {
    fields: [
      { key: 'name', value: '{{input.name}}', op: 'trim' },
      { key: 'email', value: '{{input.email}}', op: 'lower' },
      { key: 'amount', value: '{{input.amount}}', op: 'number' },
    ],
    includeInput: false,
  },
  fields: [
    {
      key: 'fields',
      label: 'Field mappings',
      type: 'transformFields',
      wide: true,
      help: 'Read a value with a template, then optionally run an operation on it.',
    },
    { key: 'includeInput', label: 'Also include untouched upstream fields', type: 'boolean' },
  ],
  outputs: [{ id: 'out', label: 'Transformed data' }],
  execute: ({ config, input, resolve }) => {
    const out: Record<string, any> = config?.includeInput && isPlainObject(input) ? { ...input } : {}
    const fields: TransformField[] = Array.isArray(config?.fields) ? config.fields : []
    for (const field of fields) {
      if (!field?.key) continue
      const raw = resolve(field.value ?? '')
      const fallback = field.fallback !== undefined ? resolve(field.fallback) : undefined
      out[field.key] = field.op && field.op !== 'none' ? applyOp(raw, field.op, fallback) : raw
    }
    return {
      output: out,
      logs: [line('info', `Transformed ${fields.filter((f) => f?.key).length} field(s).`)],
    }
  },
  validateConfig: (config) => {
    const fields: TransformField[] = Array.isArray(config?.fields) ? config.fields : []
    const errors: string[] = []
    if (fields.length === 0) errors.push('Add at least one field mapping.')
    for (const field of fields) if (!field?.key) errors.push('Every mapping needs an output name.')
    return errors
  },
}

interface ValidateRule {
  field: string
  required?: boolean
  type?: 'any' | 'string' | 'number' | 'boolean' | 'email' | 'array' | 'object'
  min?: number | string
  max?: number | string
  regex?: string
  message?: string
}

const validateInput: NodeDefinition<{ rules: ValidateRule[]; onInvalid: 'branch' | 'fail' }> = {
  type: 'validate_input',
  label: 'Validate Input',
  category: 'data',
  icon: 'ShieldCheck',
  description: 'Checks the incoming data against rules and routes to a Valid or Invalid branch.',
  hasInput: true,
  defaultConfig: {
    rules: [
      { field: 'email', required: true, type: 'email', message: 'A valid email is required.' },
      { field: 'name', required: true, type: 'string' },
    ],
    onInvalid: 'branch',
  },
  fields: [
    { key: 'rules', label: 'Validation rules', type: 'validateRules', wide: true },
    {
      key: 'onInvalid',
      label: 'When invalid',
      type: 'select',
      options: [
        { value: 'branch', label: 'Route to the Invalid branch' },
        { value: 'fail', label: 'Fail the workflow' },
      ],
    },
  ],
  outputs: [
    { id: 'valid', label: 'Valid' },
    { id: 'invalid', label: 'Invalid' },
  ],
  execute: ({ config, input, resolve }) => {
    const rules: ValidateRule[] = Array.isArray(config?.rules) ? config.rules : []
    const errors: { field: string; message: string }[] = []
    const value = input

    for (const rule of rules) {
      if (!rule?.field) continue
      const fieldValue = getByPath(value, rule.field)
      const label = rule.field

      if (rule.required && (fieldValue === undefined || fieldValue === null || fieldValue === '')) {
        errors.push({ field: rule.field, message: rule.message || `"${label}" is required.` })
        continue
      }
      if (fieldValue === undefined || fieldValue === null || fieldValue === '') continue

      if (rule.type && rule.type !== 'any') {
        const t = rule.type
        const ok =
          (t === 'string' && (typeof fieldValue === 'string' || typeof fieldValue === 'number')) ||
          (t === 'number' && toNumber(fieldValue) !== undefined) ||
          (t === 'boolean' && typeof fieldValue === 'boolean') ||
          (t === 'email' && isEmail(fieldValue)) ||
          (t === 'array' && Array.isArray(fieldValue)) ||
          (t === 'object' && isPlainObject(fieldValue))
        if (!ok) {
          errors.push({ field: rule.field, message: rule.message || `"${label}" must be a ${t}.` })
          continue
        }
      }

      const num = toNumber(fieldValue)
      const min = rule.min !== undefined && rule.min !== '' ? toNumber(resolve(rule.min)) : undefined
      const max = rule.max !== undefined && rule.max !== '' ? toNumber(resolve(rule.max)) : undefined
      if (min !== undefined && num !== undefined && num < min) {
        errors.push({ field: rule.field, message: rule.message || `"${label}" must be at least ${min}.` })
      }
      if (max !== undefined && num !== undefined && num > max) {
        errors.push({ field: rule.field, message: rule.message || `"${label}" must be at most ${max}.` })
      }
      if (min !== undefined && num === undefined && typeof fieldValue === 'string' && fieldValue.length < min) {
        errors.push({ field: rule.field, message: rule.message || `"${label}" is too short (min ${min}).` })
      }
      if (max !== undefined && num === undefined && typeof fieldValue === 'string' && fieldValue.length > max) {
        errors.push({ field: rule.field, message: rule.message || `"${label}" is too long (max ${max}).` })
      }

      if (rule.regex) {
        try {
          if (!new RegExp(rule.regex).test(String(fieldValue))) {
            errors.push({ field: rule.field, message: rule.message || `"${label}" is not in the expected format.` })
          }
        } catch {
          errors.push({ field: rule.field, message: `Invalid regex in a rule for "${label}".` })
        }
      }
    }

    const valid = errors.length === 0
    const branch = valid ? 'valid' : 'invalid'

    if (!valid && config?.onInvalid === 'fail') {
      throw new Error(`Validation failed: ${errors.map((e) => e.message).join(' ')}`)
    }

    return {
      output: withBranchMeta(input, branch, { valid, errors }),
      branch,
      logs: [
        valid
          ? line('success', 'Input passed validation.')
          : line('warn', `Validation found ${errors.length} problem(s).`),
      ],
    }
  },
  validateConfig: (config) => {
    const rules: ValidateRule[] = Array.isArray(config?.rules) ? config.rules : []
    if (rules.length === 0) return ['Add at least one validation rule.']
    const errors: string[] = []
    for (const rule of rules) if (!rule?.field) errors.push('Every rule needs a field name.')
    return errors
  },
}

const logOutput: NodeDefinition<{ level: 'info' | 'success' | 'warn' | 'error'; message: string }> = {
  type: 'log_output',
  label: 'Log Output',
  category: 'data',
  icon: 'Terminal',
  description: 'Writes a message to the execution log and passes data through unchanged.',
  hasInput: true,
  defaultConfig: { level: 'info', message: 'Data at this step: {{input}}' },
  fields: [
    {
      key: 'level',
      label: 'Level',
      type: 'select',
      options: [
        { value: 'info', label: 'Info' },
        { value: 'success', label: 'Success' },
        { value: 'warn', label: 'Warning' },
        { value: 'error', label: 'Error' },
      ],
    },
    { key: 'message', label: 'Message', type: 'textarea', wide: true, help: 'Templates are supported.' },
  ],
  outputs: [{ id: 'out', label: 'Passthrough' }],
  execute: ({ config, input, resolve }) => {
    const level = (config?.level ?? 'info') as 'info' | 'success' | 'warn' | 'error'
    const message = resolve(config?.message ?? '{{input}}')
    return {
      output: input,
      logs: [line(level, typeof message === 'string' ? message : JSON.stringify(message))],
    }
  },
}

registerNode(setValue)
registerNode(transform)
registerNode(validateInput)
registerNode(logOutput)
