import { useState } from 'react'
import { useStore } from '../store/useStore'
import { runAiTransform } from '../lib/ai'
import { hasLiveAi } from '../lib/settings'
import { Icon } from '../components/Icon'
import { Badge, Button, Card, Labeled, SectionTitle, TextInput, inputClass } from '../components/ui'
import { listNodeDefinitions } from '../engine/registry'
import { CATEGORY_COLOR } from '../components/FlowNode'

export function Settings() {
  const aiSettings = useStore((s) => s.aiSettings)
  const setAiSettings = useStore((s) => s.setAiSettings)
  const workflows = useStore((s) => s.workflows)
  const clearExecutions = useStore((s) => s.clearExecutions)

  const [draft, setDraft] = useState(aiSettings)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const save = () => {
    setAiSettings(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const test = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const { result, model, transport } = await runAiTransform(
        'Return a short JSON object with a "status" field set to "ok".',
        { ping: true },
        draft,
      )
      setTestResult({ ok: true, message: `${transport} · ${model} · ${JSON.stringify(result).slice(0, 160)}` })
    } catch (error: any) {
      setTestResult({ ok: false, message: error?.message ?? 'Request failed.' })
    } finally {
      setTesting(false)
    }
  }

  const definitions = listNodeDefinitions()

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-5 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
        <p className="mt-1 text-sm text-ink-400">
          Configure the optional AI provider, inspect the node catalog, and manage local data.
        </p>
      </div>

      <Card className="p-5">
        <SectionTitle
          title="AI provider"
          description="The AI nodes work out of the box on a labelled demo adapter. Add a key to use a live OpenAI-compatible model."
          right={<Badge tone={hasLiveAi(draft) ? 'mint' : 'amber'}>{hasLiveAi(draft) ? 'live' : 'demo'}</Badge>}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Labeled label="Provider" className="sm:col-span-2">
            <select
              className={inputClass}
              value={draft.provider}
              onChange={(e) => setDraft({ ...draft, provider: e.target.value as typeof draft.provider })}
            >
              <option value="demo">Demo adapter (offline, no key)</option>
              <option value="openai-compatible">OpenAI-compatible API (live)</option>
            </select>
          </Labeled>
          <Labeled label="API key" help="Stored in this browser's localStorage only. Never committed or bundled.">
            <TextInput
              type="password"
              placeholder="sk-…"
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
              disabled={draft.provider === 'demo'}
            />
          </Labeled>
          <Labeled label="Model">
            <TextInput
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              disabled={draft.provider === 'demo'}
            />
          </Labeled>
          <Labeled label="Base URL" className="sm:col-span-2">
            <TextInput
              value={draft.baseUrl}
              onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
              disabled={draft.provider === 'demo'}
            />
          </Labeled>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={save}>
            <Icon name="Save" size={15} /> Save settings
          </Button>
          <Button variant="secondary" onClick={test} disabled={testing}>
            <Icon name={testing ? 'Loader2' : 'Zap'} size={15} className={testing ? 'animate-spin' : undefined} />
            Test connection
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-xs text-mint-400">
              <Icon name="Check" size={13} /> Saved
            </span>
          )}
        </div>

        {testResult && (
          <p
            className={
              testResult.ok
                ? 'mt-3 rounded-lg border border-mint-500/30 bg-mint-500/10 px-3 py-2 text-xs text-mint-200'
                : 'mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200'
            }
          >
            {testResult.ok ? 'Success: ' : 'Failed: '}
            {testResult.message}
          </p>
        )}

        <p className="mt-3 flex items-start gap-2 text-[11px] text-ink-400">
          <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
          Live calls are made directly from your browser to the provider, so the key stays on this machine. Use a restricted
          key and never paste production secrets into a shared demo.
        </p>
      </Card>

      <Card className="p-5">
        <SectionTitle title="Node catalog" description={`${definitions.length} node types are registered in the engine.`} />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {definitions.map((def) => (
            <div key={def.type} className="flex items-start gap-2.5 rounded-lg border border-ink-700 bg-ink-900/50 p-2.5">
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${CATEGORY_COLOR[def.category]}22`, color: CATEGORY_COLOR[def.category] }}
              >
                <Icon name={def.icon} size={15} />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-medium text-white">
                  {def.label}
                  {def.demoOnly && <Badge tone="amber">demo</Badge>}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-ink-400">{def.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle title="Local data" description="CtrlFreaks stores everything in your browser (localStorage). No server or database is required." />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{workflows.length} workflows</Badge>
          <Button
            variant="ghost"
            className="text-rose-300 hover:bg-rose-500/10"
            onClick={() => {
              if (confirm('Delete all execution history? Workflows are kept.')) clearExecutions()
            }}
          >
            <Icon name="Trash2" size={15} /> Clear execution history
          </Button>
        </div>
      </Card>
    </div>
  )
}
