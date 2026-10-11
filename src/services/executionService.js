import { request } from './api.js'
import { demoExecutions, demoStats, demoActivity } from '../data/mock.js'

/**
 * Execution history + dashboard service.
 * Backend routes (see server/routes/executions.js):
 *   GET /executions?search=&status=&mode=&page=&limit=
 *   GET /executions/:id
 *   GET /dashboard/stats
 */

export async function listExecutions({ search = '', status = 'all', mode = 'all', page = 1, limit = 6 } = {}) {
  const fallback = () => {
    let rows = [...demoExecutions]
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (r) =>
          r.workflowName.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.trigger.toLowerCase().includes(q),
      )
    }
    if (status !== 'all') rows = rows.filter((r) => r.status === status)
    if (mode !== 'all') rows = rows.filter((r) => r.mode === mode)
    const total = rows.length
    const start = (page - 1) * limit
    return {
      items: rows.slice(start, start + limit),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }
  }
  return request('/executions', {
    params: { search, status, mode, page, limit },
    fallback,
  })
}

export async function getExecution(id) {
  return request(`/executions/${id}`, {
    fallback: () => demoExecutions.find((e) => e.id === id) || null,
  })
}

export async function getDashboard() {
  const fallback = () => ({
    stats: demoStats,
    recentWorkflows: demoExecutions.slice(0, 4),
    activity: demoActivity,
  })
  return request('/dashboard/stats', { fallback })
}
