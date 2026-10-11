/**
 * Tiny className helper — joins truthy class values.
 * Kept dependency-free so the bundle stays small.
 */
export function cn(...parts) {
  const out = []
  for (const p of parts) {
    if (!p) continue
    if (typeof p === 'string') out.push(p)
    else if (Array.isArray(p)) {
      const inner = cn(...p)
      if (inner) out.push(inner)
    } else if (typeof p === 'object') {
      for (const [k, v] of Object.entries(p)) if (v) out.push(k)
    }
  }
  return out.join(' ')
}
