import Badge, { STATUS_TONES } from './Badge.jsx'

const LABELS = {
  success: 'Success',
  pass: 'Pass',
  active: 'Active',
  running: 'Running',
  warning: 'Warning',
  warn: 'Warn',
  paused: 'Paused',
  failed: 'Failed',
  fail: 'Fail',
  error: 'Error',
  skipped: 'Skipped',
  draft: 'Draft',
  idle: 'Idle',
  pending: 'Pending',
}

export default function StatusPill({ status, className, showDot = true }) {
  const tone = STATUS_TONES[status] || 'neutral'
  return (
    <Badge tone={tone} dot={showDot} className={className}>
      {LABELS[status] || status}
    </Badge>
  )
}
