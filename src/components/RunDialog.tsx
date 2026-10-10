import { useEffect, useState } from 'react'
import type { Workflow } from '../types/workflow'
import { defaultTriggerFor } from '../store/useStore'
import { Button, Labeled, Modal, TextArea } from './ui'
import { Icon } from './Icon'

export function RunDialog({
  open,
  workflow,
  onClose,
  onRun,
  running,
}: {
  open: boolean
  workflow: Workflow | null
  onClose: () => void
  onRun: (trigger: any) => void
  running: boolean
}) {
  const [text, setText] = useState('{}')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && workflow) {
      setText(JSON.stringify(defaultTriggerFor(workflow), null, 2))
      setError(null)
    }
  }, [open, workflow])

  const parse = (): { ok: boolean; value?: any; error?: string } => {
    if (!text.trim()) return { ok: true, value: {} }
    try {
      return { ok: true, value: JSON.parse(text) }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }

  const handleRun = () => {
    const parsed = parse()
    if (!parsed.ok) {
      setError(parsed.error ?? 'Invalid JSON')
      return
    }
    setError(null)
    onRun(parsed.value)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Run workflow"
      description="Provide the payload your trigger node will receive. Templates like {{trigger.field}} read from this."
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleRun} disabled={running}>
            <Icon name="Play" size={15} /> {running ? 'Running…' : 'Run now'}
          </Button>
        </>
      }
    >
      <Labeled label="Trigger payload (JSON)" help="Leave as {} to run with an empty payload.">
        <TextArea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[240px]" spellCheck={false} />
      </Labeled>
      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-300">
          <Icon name="AlertTriangle" size={13} /> {error}
        </p>
      )}
    </Modal>
  )
}
