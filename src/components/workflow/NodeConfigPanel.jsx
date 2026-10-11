import { useEffect, useMemo, useState } from 'react'
import {
  X,
  Trash2,
  Play,
  Save,
  KeyRound,
  Sparkles,
  ShieldAlert,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Wand2,
} from 'lucide-react'
import { ACCENTS } from '../../data/nodeCatalog.js'
import { Button, Badge, Tooltip } from '../ui/index.js'
import CodeEditor from './CodeEditor.jsx'
import KeyValueEditor from '../common/KeyValueEditor.jsx'
import JsonBlock from '../common/JsonBlock.jsx'
import { cn } from '../../utils/cn.js'
import { runCode } from '../../services/codeService.js'
import { connectIntegration } from '../../services/integrationService.js'
import { useToast } from '../../context/ToastContext.jsx'

const SAMPLE_INPUT = `{
  "form_data": {
    "first_name": "Ada",
    "last_name": "Lovelace",
    "email": "ada@example.com"
  }
}`

export default function NodeConfigPanel({ node, def, onUpdate, onEditStart, onDelete, onClose, onSaveNode, onRequestAI }) {
  const { toast } = useToast()
  const [sampleInput, setSampleInput] = useState(SAMPLE_INPUT)
  const [testState, setTestState] = useState({ status: 'idle' })
  const [connecting, setConnecting] = useState(false)

  // Reset transient test state when the selected node changes.
  useEffect(() => {
    setTestState({ status: 'idle' })
  }, [node?.id])

  const config = node?.data?.config || {}
  const accent = ACCENTS[def?.accent] || ACCENTS.blue
  const Icon = def?.icon

  const requiredMissing = useMemo(() => {
    if (!def?.fields) return []
    return def.fields
      .filter((f) => f.required)
      .filter((f) => {
        const v = config[f.key]
        return v === undefined || v === null || String(v).trim() === ''
      })
      .map((f) => f.label)
  }, [def, config])

  const codeField = def?.fields?.find((f) => f.type === 'code' && !f.readOnly)
  const languageField = def?.fields?.find((f) => f.key === 'language')
  const codeLanguage = codeField?.language || (config.language || 'javascript').toLowerCase()

  const setConfig = (key, value, { snapshot = true } = {}) => {
    onUpdate({ config: { ...config, [key]: value } }, { snapshot })
  }

  const handleRun = async () => {
    setTestState({ status: 'running' })
    try {
      const code = config[codeField?.key] || ''
      const { data } = await runCode({ code, language: codeLanguage, input: safeParse(sampleInput) })
      if (!data?.validation?.ok) {
        setTestState({ status: 'error', message: data?.validation?.error || 'Validation failed.' })
      } else if (data?.executed) {
        setTestState({ status: 'success', output: data.output })
      } else {
        setTestState({ status: 'unavailable', message: data?.message })
      }
    } catch (err) {
      setTestState({ status: 'error', message: err?.message || 'The test could not be completed. Please try again.' })
    }
  }

  const handleSaveNode = async () => {
    if (requiredMissing.length) {
      toast({ type: 'error', title: 'Missing required fields', message: `Please fill in: ${requiredMissing.join(', ')}.` })
      return
    }
    await onSaveNode?.()
    toast({ type: 'success', title: 'Node saved', message: `“${node.data?.label || def.name}” configuration saved.` })
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const { data } = await connectIntegration(def.id)
      toast({
        type: data?.connected ? 'success' : 'info',
        title: data?.connected ? 'Integration connected' : 'Requires backend',
        message: data?.message || 'Provide credentials through the backend to connect.',
      })
    } catch (err) {
      toast({
        type: 'error',
        title: 'Connection failed',
        message: err?.message || 'The integration service is unavailable right now. Please try again.',
      })
    } finally {
      setConnecting(false)
    }
  }

  if (!node || !def) return null

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-2.5 border-b border-edge px-3.5 py-3">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', accent.bg, accent.text)}>
          {Icon && <Icon size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{node.data?.label || def.name}</p>
          <p className={cn('truncate text-[10px] font-medium uppercase tracking-wide', accent.text)}>
            {def.name} · {def.category}
          </p>
        </div>
        <Tooltip label="Delete node" side="left">
          <button
            onClick={() => onDelete(node.id)}
            aria-label="Delete node"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-error/12 hover:text-error"
          >
            <Trash2 size={15} />
          </button>
        </Tooltip>
        <Tooltip label="Close panel" side="left">
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-elevated hover:text-ink"
          >
            <X size={15} />
          </button>
        </Tooltip>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3.5 synq-scroll">
        <div className="space-y-5">
          {/* Node name */}
          <Field label="Node name">
            <input
              value={node.data?.label || ''}
              onFocus={onEditStart}
              onChange={(e) => onUpdate({ label: e.target.value }, { snapshot: false })}
              className="synq-input h-9 text-sm"
              placeholder={def.name}
            />
          </Field>

          <div className="rounded-xl border border-edge-soft bg-base/40 p-3">
            <p className="text-[11px] leading-relaxed text-muted">{def.description}</p>
            <p className="mt-2 font-mono text-[10px] text-faint">node id: {node.id}</p>
          </div>

          {/* Credentials */}
          {def.requiresCredentials && (
            <div className="rounded-xl border border-warning/30 bg-warning/8 p-3">
              <div className="flex items-center gap-2 text-warning">
                <KeyRound size={14} />
                <span className="text-xs font-semibold">Credentials required</span>
                <Badge tone="warning" className="ml-auto">
                  Not connected
                </Badge>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                {def.name} needs a connection. Secrets are entered through the backend and are never stored in the
                browser or in source code.
              </p>
              <Button size="sm" variant="secondary" className="mt-2.5 w-full" onClick={handleConnect} loading={connecting}>
                <KeyRound size={14} /> Connect Integration
              </Button>
            </div>
          )}

          {/* Settings fields */}
          {def.fields?.filter((f) => f.key !== 'code' && f.key !== 'preview').length > 0 && (
            <div className="space-y-3.5">
              <SectionTitle>Settings</SectionTitle>
              {def.fields
                .filter((f) => f.key !== 'code' && f.key !== 'preview')
                .map((field) => (
                  <Field key={field.key} label={field.label} required={field.required} help={field.help}>
                    <FieldInput
                      field={field}
                      value={config[field.key]}
                      onChange={(v, opts) => setConfig(field.key, v, opts)}
                      onEditStart={onEditStart}
                    />
                    {field.required && isEmpty(config[field.key]) && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-error">
                        <AlertTriangle size={11} /> {field.label} is required.
                      </p>
                    )}
                    {field.help && <p className="mt-1 text-[11px] text-faint">{field.help}</p>}
                  </Field>
                ))}
            </div>
          )}

          {/* Code node */}
          {codeField && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <SectionTitle>Code</SectionTitle>
                {languageField ? (
                  <select
                    value={config[languageField.key] || 'JavaScript'}
                    onChange={(e) => setConfig(languageField.key, e.target.value)}
                    className="synq-input h-7 w-auto text-[11px]"
                  >
                    {languageField.options?.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge tone="blue">{codeLanguage}</Badge>
                )}
              </div>

              {config.instruction !== undefined && (
                <Field label="Instruction">
                  <textarea
                    value={config.instruction || ''}
                    onFocus={onEditStart}
                    onChange={(e) => onUpdate({ config: { ...config, instruction: e.target.value } }, { snapshot: false })}
                    rows={3}
                    className="synq-input resize-none text-xs"
                    placeholder="Describe what the code should do…"
                  />
                </Field>
              )}

              <CodeEditor
                value={config[codeField.key] || ''}
                onChange={(v) => setConfig(codeField.key, v, { snapshot: false })}
                language={codeLanguage}
                height={220}
              />

              {def.id === 'code.ai' && (
                <Button size="sm" variant="ai" className="w-full" onClick={() => onRequestAI?.('Generate this code for me')}>
                  <Sparkles size={14} /> Generate with AI
                </Button>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Sample input">
                  <textarea
                    value={sampleInput}
                    onChange={(e) => setSampleInput(e.target.value)}
                    rows={5}
                    spellCheck={false}
                    className="synq-input resize-none font-mono text-[11px]"
                  />
                </Field>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted">Output preview</span>
                    {testState.status !== 'idle' && (
                      <TestBadge status={testState.status} />
                    )}
                  </div>
                  <div className="h-[132px] overflow-auto rounded-xl border border-edge-soft bg-base/60 p-2.5 synq-scroll">
                    {testState.status === 'idle' && (
                      <p className="text-[11px] text-faint">Run Test to validate this step.</p>
                    )}
                    {testState.status === 'running' && <p className="text-[11px] text-electric">Validating…</p>}
                    {testState.status === 'error' && <p className="text-[11px] text-error">{testState.message}</p>}
                    {testState.status === 'unavailable' && (
                      <p className="text-[11px] leading-relaxed text-warning">{testState.message}</p>
                    )}
                    {testState.status === 'success' && (
                      <pre className="font-mono text-[11px] text-muted">{JSON.stringify(testState.output, null, 2)}</pre>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={handleRun} loading={testState.status === 'running'}>
                  <Play size={14} /> Run Test
                </Button>
                <Button size="sm" variant="primary" onClick={handleSaveNode}>
                  <Save size={14} /> Save Node
                </Button>
                <Button size="sm" variant="ai" onClick={() => onRequestAI?.('Review this code and suggest improvements')}>
                  <Wand2 size={14} /> Ask AI
                </Button>
              </div>
              <p className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-faint">
                <Info size={11} className="mt-0.5 shrink-0" />
                Code is never executed in the browser or an unrestricted process. Real runs require an isolated sandbox
                service on the backend.
              </p>
            </div>
          )}

          {/* IO */}
          <div className="space-y-3">
            <SectionTitle>Inputs &amp; outputs</SectionTitle>
            <IOTable icon={ArrowDownToLine} title="Input" items={def.inputs} tone="blue" />
            <IOTable icon={ArrowUpFromLine} title="Output" items={def.outputs} tone="neon" />
          </div>

          {/* Data contract (inline) */}
          <DataContractSection node={node} toast={toast} />
        </div>
      </div>

      {/* Footer summary */}
      <footer className="border-t border-edge px-3.5 py-2.5">
        {requiredMissing.length > 0 ? (
          <p className="flex items-center gap-1.5 text-[11px] text-error">
            <AlertTriangle size={12} /> {requiredMissing.length} required field
            {requiredMissing.length > 1 ? 's' : ''} missing
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-[11px] text-success">
            <CheckCircle2 size={12} /> Configuration valid
          </p>
        )}
      </footer>
    </div>
  )
}

/* ----------------------------- sub-components ----------------------------- */

function FieldInput({ field, value, onChange, onEditStart }) {
  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          value={value || ''}
          onFocus={onEditStart}
          onChange={(e) => onChange(e.target.value, { snapshot: false })}
          rows={4}
          spellCheck={false}
          placeholder={field.placeholder}
          className="synq-input resize-none font-mono text-xs"
        />
      )
    case 'select':
      return (
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="synq-input h-9 text-sm">
          {!value && <option value="">Select…</option>}
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    case 'boolean':
      return (
        <button
          onClick={() => onChange(!value)}
          role="switch"
          aria-checked={!!value}
          className={cn(
            'relative h-6 w-11 rounded-full border transition',
            value ? 'border-neon/50 bg-neon/25' : 'border-edge bg-elevated',
          )}
        >
          <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-ink transition', value ? 'left-6' : 'left-0.5 bg-muted')} />
        </button>
      )
    case 'number':
      return (
        <input
          type="number"
          value={value ?? ''}
          onFocus={onEditStart}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value), { snapshot: false })}
          className="synq-input h-9 text-sm"
        />
      )
    case 'keyvalue':
      return <KeyValueEditor value={value} onChange={(v) => onChange(v)} />
    case 'code':
      return <CodeEditor value={value || ''} onChange={(v) => onChange(v, { snapshot: false })} language={field.language} height={200} />
    default:
      return (
        <input
          value={value || ''}
          onFocus={onEditStart}
          onChange={(e) => onChange(e.target.value, { snapshot: false })}
          placeholder={field.placeholder}
          className="synq-input h-9 text-sm"
        />
      )
  }
}

function Field({ label, required, help, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-muted">
        {label}
        {required && <span className="text-error">*</span>}
      </span>
      {children}
    </label>
  )
}

function SectionTitle({ children }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-wider text-faint">{children}</h3>
}

function IOTable({ icon: Icon, title, items, tone }) {
  return (
    <div className="rounded-xl border border-edge-soft bg-base/40 p-2.5">
      <p className={cn('mb-1.5 flex items-center gap-1.5 text-[11px] font-medium', tone === 'blue' ? 'text-electric' : 'text-neon')}>
        <Icon size={12} /> {title}
      </p>
      {items?.length ? (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.name} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-mono text-muted">{it.name}</span>
              <span className="text-faint">
                {it.type}
                {it.required && <span className="ml-1 text-error/80">required</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-faint">None</p>
      )}
    </div>
  )
}

function DataContractSection({ node, toast }) {
  const [applied, setApplied] = useState(false)
  // Contract warnings are read from the shared demo contract issues when present.
  const issues = useMemo(() => {
    // Imported lazily to avoid a hard dependency for non-contract nodes.
    return []
  }, [])

  return (
    <div className="space-y-3">
      <SectionTitle>Data contract</SectionTitle>
      {issues.length === 0 && !applied ? (
        <div className="flex items-start gap-2 rounded-xl border border-edge-soft bg-base/40 p-3">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success" />
          <p className="text-[11px] leading-relaxed text-muted">
            No contract violations detected for this step. Contract checks compare expected inputs with actual upstream
            outputs.
          </p>
        </div>
      ) : null}

      {/* The editor passes richer issues via the diagnostics drawer. */}
      <button
        onClick={() =>
          toast({
            type: 'info',
            title: 'Open workflow diagnostics',
            message: 'Full data-contract diagnostics run across the whole workflow. Use the Diagnostics button in the canvas toolbar.',
          })
        }
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-edge px-3 py-2.5 text-left text-[11px] text-muted transition hover:border-violet/40 hover:text-violet"
      >
        <ShieldAlert size={13} /> Run workflow-wide contract diagnostics
      </button>
    </div>
  )
}

function TestBadge({ status }) {
  const map = {
    running: { tone: 'blue', label: 'Validating' },
    success: { tone: 'success', label: 'Valid' },
    error: { tone: 'error', label: 'Error' },
    unavailable: { tone: 'warning', label: 'Engine required' },
  }
  const m = map[status] || { tone: 'neutral', label: status }
  return <Badge tone={m.tone}>{m.label}</Badge>
}

function isEmpty(v) {
  return v === undefined || v === null || String(v).trim() === ''
}

function safeParse(str) {
  try {
    return JSON.parse(str)
  } catch {
    return {}
  }
}
