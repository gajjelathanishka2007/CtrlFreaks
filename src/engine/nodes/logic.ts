import { registerNode } from '../registry'
import type { NodeDefinition } from '../types'
import { evaluateOperator, line, withBranchMeta } from './helpers'

interface ConditionRule {
  left: string
  operator: string
  right?: string
}

const condition: NodeDefinition<{ logic: 'and' | 'or'; rules: ConditionRule[] }> = {
  type: 'condition',
  label: 'Condition',
  category: 'logic',
  icon: 'GitBranch',
  description: 'Sends data down a True or False branch based on one or more rules.',
  hasInput: true,
  defaultConfig: {
    logic: 'and',
    rules: [{ left: '{{input.amount}}', operator: 'greaterThan', right: '100' }],
  },
  fields: [
    {
      key: 'logic',
      label: 'Match',
      type: 'select',
      options: [
        { value: 'and', label: 'All rules must be true (AND)' },
        { value: 'or', label: 'Any rule can be true (OR)' },
      ],
    },
    { key: 'rules', label: 'Rules', type: 'conditionRules', wide: true, help: 'Left and right support templates.' },
  ],
  outputs: [
    { id: 'true', label: 'True' },
    { id: 'false', label: 'False' },
  ],
  execute: ({ config, input, resolve }) => {
    const rules: ConditionRule[] = Array.isArray(config?.rules) ? config.rules : []
    const results = rules.map((rule) => {
      const left = resolve(rule.left ?? '')
      const right = resolve(rule.right ?? '')
      return evaluateOperator(rule.operator ?? 'equals', left, right)
    })
    const result =
      results.length === 0
        ? false
        : config?.logic === 'or'
          ? results.some(Boolean)
          : results.every(Boolean)
    const branch = result ? 'true' : 'false'
    return {
      output: withBranchMeta(input, branch, { result }),
      branch,
      logs: [line('info', `Condition evaluated to ${result}.`)],
    }
  },
  validateConfig: (config) => {
    const rules: ConditionRule[] = Array.isArray(config?.rules) ? config.rules : []
    if (rules.length === 0) return ['Add at least one rule.']
    const errors: string[] = []
    for (const rule of rules) if (!rule?.left) errors.push('Every rule needs a left-hand value.')
    return errors
  },
}

interface SwitchCase {
  value: string
  label?: string
}

const switchNode: NodeDefinition<{ field: string; cases: SwitchCase[]; defaultLabel: string }> = {
  type: 'switch',
  label: 'Switch',
  category: 'logic',
  icon: 'Split',
  description: 'Routes data to the first matching case, otherwise to the Default branch.',
  hasInput: true,
  defaultConfig: {
    field: '{{input.status}}',
    cases: [
      { value: 'new', label: 'New' },
      { value: 'in_progress', label: 'In progress' },
    ],
    defaultLabel: 'Default',
  },
  fields: [
    { key: 'field', label: 'Value to switch on', type: 'text', help: 'Usually a template like {{input.status}}.' },
    { key: 'cases', label: 'Cases', type: 'switchCases', wide: true },
    { key: 'defaultLabel', label: 'Default branch label', type: 'text' },
  ],
  outputs: [],
  execute: ({ config, input, resolve }) => {
    const cases: SwitchCase[] = Array.isArray(config?.cases) ? config.cases : []
    const subject = resolve(config?.field ?? '')
    let branch = 'default'
    for (let i = 0; i < cases.length; i++) {
      const caseValue = resolve(cases[i]?.value ?? '')
      if (String(caseValue) === String(subject)) {
        branch = `case_${i}`
        break
      }
    }
    return {
      output: withBranchMeta(input, branch, { matched: branch !== 'default', subject }),
      branch,
      logs: [line('info', `Switch matched branch "${branch}".`)],
    }
  },
  validateConfig: (config) => {
    const errors: string[] = []
    if (!config?.field) errors.push('Choose a value to switch on.')
    const cases: SwitchCase[] = Array.isArray(config?.cases) ? config.cases : []
    if (cases.length === 0) errors.push('Add at least one case.')
    return errors
  },
}

registerNode(condition)
registerNode(switchNode)
