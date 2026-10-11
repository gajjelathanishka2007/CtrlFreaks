import { UserPlus, Shield, Mail } from 'lucide-react'
import PageHeader, { PageBody } from '../components/layout/PageHeader.jsx'
import { SectionCard } from '../components/common/SectionCard.jsx'
import { Button, Badge } from '../components/ui/index.js'
import { useToast } from '../context/ToastContext.jsx'

const MEMBERS = [
  { name: 'Sri Rao', email: 'sri@synq.dev', role: 'Owner', color: 'from-neon/70 to-electric/70' },
  { name: 'Ada Lovelace', email: 'ada@synq.dev', role: 'Developer', color: 'from-electric/70 to-violet/70' },
  { name: 'Grace Hopper', email: 'grace@synq.dev', role: 'Developer', color: 'from-violet/70 to-neon/70' },
  { name: 'Alan Turing', email: 'alan@synq.dev', role: 'Viewer', color: 'from-warning/70 to-electric/70' },
]

const ROLE_TONE = { Owner: 'neon', Developer: 'blue', Viewer: 'neutral' }

export default function Teams() {
  const { toast } = useToast()

  const invite = () =>
    toast({
      type: 'info',
      title: 'Demo action',
      message: 'Inviting team members requires a connected backend. This button is wired but not live.',
    })

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        className="border-b border-edge bg-sidebar/40 px-4 py-4 sm:px-6 lg:px-8"
        title="Teams"
        subtitle="Collaborators who can view, edit, and publish workflows in this workspace."
        actions={
          <Button variant="primary" size="sm" onClick={invite}>
            <UserPlus size={15} /> Invite member
          </Button>
        }
      />
      <PageBody>
        <SectionCard title="Members" description={`${MEMBERS.length} people`} icon={Shield}>
          <ul className="divide-y divide-edge-soft">
            {MEMBERS.map((m) => (
              <li key={m.email} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${m.color} text-xs font-bold text-[#04140D]`}>
                    {m.name.split(' ').map((n) => n[0]).join('')}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{m.name}</p>
                    <p className="flex items-center gap-1.5 truncate text-xs text-faint">
                      <Mail size={11} /> {m.email}
                    </p>
                  </div>
                </div>
                <Badge tone={ROLE_TONE[m.role]}>{m.role}</Badge>
              </li>
            ))}
          </ul>
        </SectionCard>
      </PageBody>
    </div>
  )
}
