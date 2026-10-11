import { getNodeDefinition } from '../engine/registry'
import type { FieldSpec, NodeType, WorkflowNode } from '../types/workflow'
import { CONDITION_OPERATORS, TRANSFORM_OPS } from '../engine/nodes/helpers'
import { cn, pretty } from '../lib/utils'
import { Icon } from './Icon'
import { Badge, Button, Labeled, TextArea, TextInput, inputClass } from './ui'
import { CATEGORY_COLOR } from './FlowNode'

interface ConfigPanelProps {
  node: WorkflowNode
  onChange: (config: Record<string, any>) => void
  onRename: (name: string) => void
  onToggleDisabled: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export function ConfigPanel({
  node,
  onChange,
  onRename,
  onToggleDisabled,
  onDuplicate,
  onDelete,
}: ConfigPanelProps) {
  const def = getNodeDefinition(node.type)
  const config = node.config ?? {}
  const set = (key: string, value: any) => onChange({ ...config, [key]: value })

  if (!def) {
    return <div className="p-4 text-sm text-rose-300">Unsupported node type: {node.type}</div>
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-ink-700/80 p-4">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: `${CATEGORY_COLOR[def.category]}22`, color: CATEGORY_COLOR[def.category] }}
          >
            <Icon name={def.icon} size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{def.label}</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Badge tone="neutral">{def.category}</Badge>
              {def.demoOnly && <Badge tone="amber">demo adapter</Badge>}
            </div>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-ink-400">{def.description}</p>

        <Labeled label="Step name">
          <TextInput value={node.name} onChange={(e) => onRename(e.target.value)} />
        </Labeled>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {def.fields.length === 0 && <p className="text-xs text-ink-400">This node has no options.</p>}

        {def.fields.map((field) => (
          <ConfigField
            key={field.key}
            field={field}
            value={config[field.key]}
            onChange={(value) => set(field.key, value)}
          />
        ))}

        <div className="rounded-lg border border-ink-700 bg-ink-900/60 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-ink-300">
            <Icon name="Code2" size={12} /> Data reference
          </p>
          <p className="text-[11px] leading-relaxed text-ink-400">
            Use <code className="text-accent-400">{'{{input.field}}'}</code>,{' '}
            <code className="text-accent-400">{'{{trigger.field}}'}</code> or{' '}
            <code className="text-accent-400">{'{{node.<id>.field}}'}</code> in any value.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-ink-700/80 p-3">
        <Button size="sm" variant="ghost" onClick={onToggleDisabled}>
          <Icon name="Power" size={14} /> {node.disabled ? 'Enable' : 'Disable'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDuplicate}>
          <Icon name="Copy" size={14} /> Duplicate
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto text-rose-300 hover:bg-rose-500/10" onClick={onDelete}>
          <Icon name="Trash2" size={14} /> Delete
        </Button>
      </div>
    </div>
  )
}

function ConfigField({
  field,
  value,
  onChange,
}: {
  field: FieldSpec
  value: any
  onChange: (value: any) => void
}) {
  switch (field.type) {
    case 'text':
      return (
        <Labeled label={field.label} help={field.help}>
          <TextInput value={value ?? ''} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
        </Labeled>
      )
    case 'textarea':
      return (
        <Labeled label={field.label} help={field.help}>
          <TextArea value={value ?? ''} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
        </Labeled>
      )
    case 'number':
      return (
        <Labeled label={field.label} help={field.help}>
          <TextInput
            type="number"
            value={value ?? ''}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </Labeled>
      )
    case 'boolean':
      return (
        <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-200">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-ink-500 bg-ink-900 accent-[var(--color-accent-500)]"
          />
          <span className="font-medium">{field.label}</span>
          {field.help && <span className="text-ink-400">— {field.help}</span>}
        </label>
      )
    case 'select':
      return (
        <Labeled label={field.label} help={field.help}>
          <select className={inputClass} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
            {(field.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Labeled>
      )
    case 'json':
      return (
        <Labeled label={field.label} help={field.help}>
          <TextArea
            value={value ?? ''}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="font-mono"
          />
          <JsonHint value={value} />
        </Labeled>
      )
    case 'keyvalue':
      return <KeyValueEditor label={field.label} help={field.help} value={value} onChange={onChange} />
    case 'conditionRules':
      return <ConditionRulesEditor label={field.label} help={field.help} value={value} onChange={onChange} />
    case 'transformFields':
      return <TransformFieldsEditor label={field.label} help={field.help} value={value} onChange={onChange} />
    case 'validateRules':
      return <ValidateRulesEditor label={field.label} help={field.help} value={value} onChange={onChange} />
    case 'switchCases':
      return <SwitchCasesEditor label={field.label} help={field.help} value={value} onChange={onChange} />
    default:
      return null
  }
}

function JsonHint({ value }: { value: any }) {
  if (!value || typeof value !== 'string' || !value.trim()) return null
  try {
    JSON.parse(value)
    return (
      <p className="mt-1 flex items-center gap-1 text-[11px] text-mint-400">
        <Icon name="Check" size={11} /> valid JSON
      </p>
    )
  } catch (error: any) {
    return (
      <p className="mt-1 flex items-center gap-1 text-[11px] text-rose-300">
        <Icon name="AlertTriangle" size={11} /> {error.message}
      </p>
    )
  }
}

function FieldGroup({
  label,
  help,
  children,
  onAdd,
  addLabel,
}: {
  label: string
  help?: string
  children: React.ReactNode
  onAdd?: () => void
  addLabel?: string
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-medium text-ink-300">
          {label}
          {help && (
            <span className="group relative inline-flex">
              <Icon name="Info" size={12} className="text-ink-400" />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-52 -translate-x-1/2 rounded-lg border border-ink-600 bg-ink-900 px-2 py-1.5 text-[11px] font-normal text-ink-200 shadow-xl group-hover:block">
                {help}
              </span>
            </span>
          )}
        </span>
        {onAdd && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-accent-400 hover:bg-accent-500/10"
          >
            <Icon name="Plus" size={12} /> {addLabel ?? 'Add'}
          </button>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function RowShell({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="flex items-start gap-1.5 rounded-lg border border-ink-700 bg-ink-900/60 p-2">
      <div className="min-w-0 flex-1 space-y-1.5">{children}</div>
      <button
        onClick={onRemove}
        className="rounded-md p-1 text-ink-400 hover:bg-rose-500/10 hover:text-rose-300"
        aria-label="Remove"
      >
        <Icon name="X" size={13} />
      </button>
    </div>
  )
}

function KeyValueEditor({ label, help, value, onChange }: FieldGroupProps) {
  const rows: { key: string; value: string }[] = Array.isArray(value) ? value : []
  const update = (index: number, patch: Partial<{ key: string; value: string }>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  return (
    <FieldGroup
      label={label}
      help={help}
      onAdd={() => onChange([...rows, { key: '', value: '' }])}
      addLabel="Add field"
    >
      {rows.length === 0 && <p className="text-[11px] text-ink-400">No fields yet.</p>}
      {rows.map((row, index) => (
        <RowShell key={index} onRemove={() => onChange(rows.filter((_, i) => i !== index))}>
          <input
            className={cn(inputClass, 'py-1.5 text-xs')}
            placeholder="name"
            value={row.key}
            onChange={(e) => update(index, { key: e.target.value })}
          />
          <input
            className={cn(inputClass, 'py-1.5 font-mono text-xs')}
            placeholder="value or {{template}}"
            value={row.value}
            onChange={(e) => update(index, { value: e.target.value })}
          />
        </RowShell>
      ))}
    </FieldGroup>
  )
}

interface FieldGroupProps {
  label: string
  help?: string
  value: any
  onChange: (value: any) => void
}

function ConditionRulesEditor({ label, help, value, onChange }: FieldGroupProps) {
  const rows: { left: string; operator: string; right: string }[] = Array.isArray(value) ? value : []
  const update = (index: number, patch: Partial<(typeof rows)[number]>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  return (
    <FieldGroup label={label} help={help} onAdd={() => onChange([...rows, { left: '', operator: 'equals', right: '' }])} addLabel="Add rule">
      {rows.length === 0 && <p className="text-[11px] text-ink-400">No rules yet.</p>}
      {rows.map((row, index) => (
        <RowShell key={index} onRemove={() => onChange(rows.filter((_, i) => i !== index))}>
          <input
            className={cn(inputClass, 'py-1.5 font-mono text-xs')}
            placeholder="{{input.value}}"
            value={row.left}
            onChange={(e) => update(index, { left: e.target.value })}
          />
          <select
            className={cn(inputClass, 'py-1.5 text-xs')}
            value={row.operator}
            onChange={(e) => update(index, { operator: e.target.value })}
          >
            {CONDITION_OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
          <input
            className={cn(inputClass, 'py-1.5 font-mono text-xs')}
            placeholder="compare to (optional)"
            value={row.right ?? ''}
            onChange={(e) => update(index, { right: e.target.value })}
          />
        </RowShell>
      ))}
    </FieldGroup>
  )
}

function TransformFieldsEditor({ label, help, value, onChange }: FieldGroupProps) {
  const rows: { key: string; value: string; op?: string; fallback?: string }[] = Array.isArray(value) ? value : []
  const update = (index: number, patch: Partial<(typeof rows)[number]>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  return (
    <FieldGroup
      label={label}
      help={help}
      onAdd={() => onChange([...rows, { key: '', value: '', op: 'none' }])}
      addLabel="Add mapping"
    >
      {rows.length === 0 && <p className="text-[11px] text-ink-400">No mappings yet.</p>}
      {rows.map((row, index) => (
        <RowShell key={index} onRemove={() => onChange(rows.filter((_, i) => i !== index))}>
          <input
            className={cn(inputClass, 'py-1.5 text-xs')}
            placeholder="output field"
            value={row.key}
            onChange={(e) => update(index, { key: e.target.value })}
          />
          <input
            className={cn(inputClass, 'py-1.5 font-mono text-xs')}
            placeholder="{{input.value}}"
            value={row.value}
            onChange={(e) => update(index, { value: e.target.value })}
          />
          <div className="flex gap-1.5">
            <select
              className={cn(inputClass, 'py-1.5 text-xs')}
              value={row.op ?? 'none'}
              onChange={(e) => update(index, { op: e.target.value })}
            >
              {TRANSFORM_OPS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
            {row.op === 'default' && (
              <input
                className={cn(inputClass, 'py-1.5 font-mono text-xs')}
                placeholder="fallback"
                value={row.fallback ?? ''}
                onChange={(e) => update(index, { fallback: e.target.value })}
              />
            )}
          </div>
        </RowShell>
      ))}
    </FieldGroup>
  )
}

function ValidateRulesEditor({ label, help, value, onChange }: FieldGroupProps) {
  const rows: {
    field: string
    required?: boolean
    type?: string
    min?: any
    max?: any
    regex?: string
    message?: string
  }[] = Array.isArray(value) ? value : []
  const update = (index: number, patch: Partial<(typeof rows)[number]>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  return (
    <FieldGroup
      label={label}
      help={help}
      onAdd={() => onChange([...rows, { field: '', required: true, type: 'any' }])}
      addLabel="Add rule"
    >
      {rows.length === 0 && <p className="text-[11px] text-ink-400">No rules yet.</p>}
      {rows.map((row, index) => (
        <RowShell key={index} onRemove={() => onChange(rows.filter((_, i) => i !== index))}>
          <input
            className={cn(inputClass, 'py-1.5 font-mono text-xs')}
            placeholder="field name"
            value={row.field}
            onChange={(e) => update(index, { field: e.target.value })}
          />
          <div className="flex items-center gap-2">
            <select
              className={cn(inputClass, 'py-1.5 text-xs')}
              value={row.type ?? 'any'}
              onChange={(e) => update(index, { type: e.target.value })}
            >
              {['any', 'string', 'number', 'boolean', 'email', 'array', 'object'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label className="flex shrink-0 items-center gap-1 text-[11px] text-ink-300">
              <input
                type="checkbox"
                checked={Boolean(row.required)}
                onChange={(e) => update(index, { required: e.target.checked })}
                className="h-3.5 w-3.5 accent-[var(--color-accent-500)]"
              />
              required
            </label>
          </div>
          <div className="flex gap-1.5">
            <input
              className={cn(inputClass, 'py-1.5 text-xs')}
              placeholder="min"
              value={row.min ?? ''}
              onChange={(e) => update(index, { min: e.target.value })}
            />
            <input
              className={cn(inputClass, 'py-1.5 text-xs')}
              placeholder="max"
              value={row.max ?? ''}
              onChange={(e) => update(index, { max: e.target.value })}
            />
          </div>
          <input
            className={cn(inputClass, 'py-1.5 font-mono text-xs')}
            placeholder="regex (optional)"
            value={row.regex ?? ''}
            onChange={(e) => update(index, { regex: e.target.value })}
          />
          <input
            className={cn(inputClass, 'py-1.5 text-xs')}
            placeholder="custom error message (optional)"
            value={row.message ?? ''}
            onChange={(e) => update(index, { message: e.target.value })}
          />
        </RowShell>
      ))}
    </FieldGroup>
  )
}

function SwitchCasesEditor({ label, help, value, onChange }: FieldGroupProps) {
  const rows: { value: string; label?: string }[] = Array.isArray(value) ? value : []
  const update = (index: number, patch: Partial<(typeof rows)[number]>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  return (
    <FieldGroup
      label={label}
      help={help}
      onAdd={() => onChange([...rows, { value: '', label: '' }])}
      addLabel="Add case"
    >
      {rows.length === 0 && <p className="text-[11px] text-ink-400">No cases yet.</p>}
      {rows.map((row, index) => (
        <RowShell key={index} onRemove={() => onChange(rows.filter((_, i) => i !== index))}>
          <div className="flex items-center gap-1.5">
            <span className="w-10 shrink-0 text-[10px] text-ink-400">match</span>
            <input
              className={cn(inputClass, 'py-1.5 font-mono text-xs')}
              placeholder="value"
              value={row.value}
              onChange={(e) => update(index, { value: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-10 shrink-0 text-[10px] text-ink-400">label</span>
            <input
              className={cn(inputClass, 'py-1.5 text-xs')}
              placeholder="Branch label"
              value={row.label ?? ''}
              onChange={(e) => update(index, { label: e.target.value })}
            />
          </div>
        </RowShell>
      ))}
    </FieldGroup>
  )
}

export function NodePreview({ node }: { node: WorkflowNode }) {
  const def = getNodeDefinition(node.type as NodeType)
  return <pre className="text-[11px] text-ink-300">{pretty({ type: node.type, config: def ? node.config : {} })}</pre>
}
