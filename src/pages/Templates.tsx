import { useNavigate } from 'react-router-dom'
import { TEMPLATES } from '../data/templates'
import { useStore } from '../store/useStore'
import { Icon } from '../components/Icon'
import { Badge, Button, Card } from '../components/ui'

export function Templates() {
  const navigate = useNavigate()
  const createFromTemplate = useStore((s) => s.createFromTemplate)

  const use = (id: string) => {
    const workflow = createFromTemplate(id)
    if (workflow) navigate(`/builder/${workflow.id}`)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Templates</h1>
        <p className="mt-1 text-sm text-ink-400">
          Start from a working workflow. Each template is fully runnable and copies into your workspace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((template) => (
          <Card key={template.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500/25 to-grape-500/25 text-accent-300">
                <Icon name="Workflow" size={20} />
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {template.tags.map((tag) => (
                  <Badge key={tag} tone="neutral">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            <h2 className="mt-3 text-base font-semibold text-white">{template.name}</h2>
            <p className="text-xs text-accent-300">{template.tagline}</p>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-ink-400">{template.description}</p>
            <Button variant="primary" className="mt-4 w-full" onClick={() => use(template.id)}>
              <Icon name="Copy" size={15} /> Use template
            </Button>
          </Card>
        ))}
      </div>

      <Card className="flex flex-wrap items-center gap-4 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-grape-500/20 text-grape-300">
          <Icon name="Sparkles" size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">Not sure where to start?</h3>
          <p className="text-xs text-ink-400">
            Describe your automation in plain English on the Dashboard and the planner will assemble a workflow for you.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/')}>
          <Icon name="Sparkles" size={15} /> Generate with AI
        </Button>
      </Card>
    </div>
  )
}
