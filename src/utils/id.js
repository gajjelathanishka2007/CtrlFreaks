/** Collision-resistant id generator usable in the browser. */
export function uid(prefix = 'id') {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().split('-')[0]
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}${rand}`
}

/** Human-readable short id, e.g. EXE-7F3A21. */
export function shortId(prefix = 'EXE') {
  return `${prefix}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`
}
