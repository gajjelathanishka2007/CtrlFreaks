import { demoWorkflows } from '../data/mock.js'
import { uid } from '../utils/id.js'

/**
 * localStorage-backed store for demo workflows.
 * Gives the mock layer real persistence so workflow edits survive reloads.
 * Replaced transparently by the backend once VITE_USE_MOCK=false.
 */

const KEY = 'synq.workflows.v1'

function seed() {
  // Deep clone so edits don't mutate the imported demo module.
  return JSON.parse(JSON.stringify(demoWorkflows))
}

export function loadWorkflows() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length) return parsed
    }
  } catch {
    /* ignore corrupt storage */
  }
  const s = seed()
  saveWorkflows(s)
  return s
}

export function saveWorkflows(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage may be unavailable (private mode) */
  }
}

export function resetWorkflows() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
  return loadWorkflows()
}

/** A minimal starter graph for a brand-new workflow. */
export function starterGraph() {
  return {
    nodes: [
      {
        id: uid('n'),
        type: 'start',
        position: { x: 120, y: 200 },
        data: {
          catalogId: 'trigger.start',
          label: 'Start',
          config: { label: 'Manual start', payload: '{\n  "first_name": "Ada",\n  "email": "ada@example.com"\n}' },
        },
      },
    ],
    edges: [],
  }
}
