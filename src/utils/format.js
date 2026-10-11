/** Formatting helpers for dates, durations and numbers. */

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelative(value) {
  if (!value) return '—'
  const d = new Date(value)
  const diff = Date.now() - d.getTime()
  const mins = Math.round(diff / 60000)
  if (Math.abs(mins) < 1) return 'just now'
  if (Math.abs(mins) < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (Math.abs(hours) < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return `${days}d ago`
  return formatDateTime(value)
}

export function formatDuration(ms) {
  if (ms == null) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)} s`
  const m = Math.floor(s / 60)
  return `${m}m ${Math.round(s % 60)}s`
}

export function formatNumber(n) {
  if (n == null) return '0'
  return new Intl.NumberFormat().format(n)
}

export function truncate(str, n = 48) {
  if (!str) return ''
  return str.length > n ? `${str.slice(0, n - 1)}…` : str
}
