import { useEffect, useState } from 'react'
import {
  Server,
  Sparkles,
  Database,
  Moon,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react'
import PageHeader, { PageBody } from '../components/layout/PageHeader.jsx'
import { SectionCard } from '../components/common/SectionCard.jsx'
import { Button, Badge, Spinner, Tooltip } from '../components/ui/index.js'
import { API_BASE_URL, USE_MOCK } from '../services/api.js'
import { getAiStatus } from '../services/aiService.js'
import { listIntegrations, connectIntegration } from '../services/integrationService.js'
import { resetDemoData } from '../services/workflowService.js'
import { useToast } from '../context/ToastContext.jsx'
import { useWorkflows } from '../context/WorkflowsContext.jsx'

export default function Settings() {
  const { toast } = useToast()
  const { refresh } = useWorkflows()
  const [ai, setAi] = useState(null)
  const [aiError, setAiError] = useState(false)
  const [integrations, setIntegrations] = useState([])
  const [integrationsError, setIntegrationsError] = useState(false)
  const [busy, setBusy] = useState(false)

  const loadAi = () => {
    setAiError(false)
    getAiStatus()
      .then(({ data }) => setAi(data))
      .catch(() => setAiError(true))
  }

  const loadIntegrations = () => {
    setIntegrationsError(false)
    listIntegrations()
      .then(({ data }) => setIntegrations(data || []))
      .catch(() => setIntegrationsError(true))
  }

  useEffect(() => {
    loadAi()
    loadIntegrations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reset = async () => {
    setBusy(true)
    try {
      await resetDemoData()
      await refresh()
      toast({ type: 'success', title: 'Demo data reset', message: 'Workflows were restored to their original sample state.' })
    } catch (err) {
      toast({
        type: 'error',
        title: 'Reset failed',
        message: err?.message || 'The demo data could not be reset. Please try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  const onConnect = async (id) => {
    try {
      const { data } = await connectIntegration(id)
      toast({
        type: data?.connected ? 'success' : 'info',
        title: data?.connected ? 'Connected' : 'Not connected',
        message: data?.message || 'A real connection requires backend OAuth credentials.',
      })
    } catch (err) {
      toast({
        type: 'error',
        title: 'Connection failed',
        message: err?.message || 'The integration service is unavailable right now. Please try again.',
      })
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        className="border-b border-edge bg-sidebar/40 px-4 py-4 sm:px-6 lg:px-8"
        title="Settings"
        subtitle="Connections, services, and workspace preferences."
      />
      <PageBody className="space-y-5">
        {/* Backend */}
        <SectionCard title="Backend API" description="Node.js + Express + MongoDB" icon={Server}>
          <div className="space-y-3">
            <Row label="API base URL" value={<code className="font-mono text-xs text-muted">{API_BASE_URL}</code>} />
            <Row
              label="Data source"
              value={
                USE_MOCK ? (
                  <Badge tone="blue" dot>
                    Mock / demo layer
                  </Badge>
                ) : (
                  <Badge tone="success" dot>
                    Live backend
                  </Badge>
                )
              }
            />
            <p className="flex items-start gap-2 rounded-lg border border-edge-soft bg-base/40 p-3 text-xs text-faint">
              <Info size={14} className="mt-0.5 shrink-0" />
              The frontend never connects to MongoDB directly. All reads and writes go through the Express API at the URL
              above. Set <code className="mx-1 rounded bg-black/30 px-1 font-mono">VITE_USE_MOCK=false</code> to use it.
            </p>
          </div>
        </SectionCard>

        {/* AI */}
        <SectionCard
          title="AI service"
          description="Powers the Synq Assistant and AI Code nodes"
          icon={Sparkles}
          actions={
            ai ? (
              ai.demo ? (
                <Badge tone="violet" dot>
                  Demo mode
                </Badge>
              ) : (
                <Badge tone="success" dot>
                  Configured
                </Badge>
              )
            ) : null
          }
        >
          {aiError ? (
            <div className="flex items-center justify-between gap-3 text-sm text-muted">
              <span className="flex items-center gap-2">
                <XCircle size={15} className="text-error" /> Couldn’t reach the AI service.
              </span>
              <Button size="xs" variant="outline" onClick={loadAi}>
                <RefreshCw size={13} /> Retry
              </Button>
            </div>
          ) : !ai ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Spinner size={15} /> Checking AI service…
            </div>
          ) : (
            <div className="space-y-3">
              <Row label="Provider" value={<span className="text-sm text-muted">{ai.provider}</span>} />
              <Row label="Model" value={<code className="font-mono text-xs text-muted">{ai.model}</code>} />
              <p className="flex items-start gap-2 rounded-lg border border-violet/25 bg-violet/8 p-3 text-xs text-violet">
                <Info size={14} className="mt-0.5 shrink-0" />
                {ai.configured
                  ? 'A real AI service is connected. Responses come from the configured model.'
                  : 'No AI key is configured, so the assistant returns clearly-labelled demo responses. Add OPENAI_API_KEY on the backend to enable live AI — never in a VITE_ variable.'}
              </p>
            </div>
          )}
        </SectionCard>

        {/* Integrations */}
        <SectionCard title="Integrations" description="Connect apps to use their nodes" icon={Database}>
          {integrationsError ? (
            <div className="flex items-center justify-between gap-3 text-sm text-muted">
              <span className="flex items-center gap-2">
                <XCircle size={15} className="text-error" /> Couldn’t load integrations.
              </span>
              <Button size="xs" variant="outline" onClick={loadIntegrations}>
                <RefreshCw size={13} /> Retry
              </Button>
            </div>
          ) : integrations.length === 0 ? (
            <div className="flex items-center gap-2 py-2 text-sm text-muted">
              <Spinner size={15} /> Loading integrations…
            </div>
          ) : (
            <ul className="divide-y divide-edge-soft">
              {integrations.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{it.name}</p>
                    <p className="flex items-center gap-1.5 text-xs text-faint">
                      {it.connected ? <CheckCircle2 size={12} className="text-success" /> : <XCircle size={12} />}
                      {it.connected ? 'Connected' : it.requiresCredentials ? 'Credentials required' : 'Not connected'}
                    </p>
                  </div>
                  <Button size="sm" variant={it.connected ? 'outline' : 'secondary'} onClick={() => onConnect(it.id)}>
                    {it.connected ? 'Manage' : 'Connect Integration'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-faint">
            Synq will not report an integration as connected until a real connection is established. Secrets are stored on
            the backend only.
          </p>
        </SectionCard>

        {/* Appearance */}
        <SectionCard title="Appearance" description="Interface theme" icon={Moon}>
          <div className="flex items-center justify-between rounded-lg border border-edge-soft bg-base/40 p-3">
            <div>
              <p className="text-sm font-medium text-ink">Dark</p>
              <p className="text-xs text-faint">Synq is designed dark-first. Light theme is on the roadmap.</p>
            </div>
            <Badge tone="neon" dot>
              Active
            </Badge>
          </div>
        </SectionCard>

        {/* Danger / data */}
        <SectionCard title="Demo data" description="Local sample data used while the backend is offline" icon={RefreshCw}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">
              Resets workflows, nodes and edges to the original sample state. Stored in your browser only.
            </p>
            <Button size="sm" variant="secondary" onClick={reset} loading={busy}>
              <RefreshCw size={14} /> Reset demo data
            </Button>
          </div>
        </SectionCard>

        <div className="flex items-center justify-center gap-2 pb-2 text-xs text-faint">
          <span>Synq · Build. Simulate. Improve.</span>
          <Tooltip label="Documentation (backend required)">
            <span className="inline-flex items-center gap-1">
              <ExternalLink size={12} /> v1.0.0
            </span>
          </Tooltip>
        </div>
      </PageBody>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}
