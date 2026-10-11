import { request, delay } from './api.js'
import { loadWorkflows, saveWorkflows, resetWorkflows, starterGraph } from './mockStore.js'
import { uid } from '../utils/id.js'

/**
 * Workflow service.
 * Maps to backend routes (see server/routes/workflows.js):
 *   GET    /workflows
 *   GET    /workflows/:id
 *   POST   /workflows
 *   PATCH  /workflows/:id
 *   PUT    /workflows/:id/graph
 *   POST   /workflows/:id/publish
 *   DELETE /workflows/:id
 */

export async function listWorkflows() {
  return request('/workflows', { fallback: () => loadWorkflows() })
}

export async function getWorkflow(id) {
  return request(`/workflows/${id}`, {
    fallback: () => {
      const wf = loadWorkflows().find((w) => w.id === id)
      if (!wf) return null
      if (!wf.graph) wf.graph = starterGraph()
      return wf
    },
  })
}

export async function createWorkflow({ name = 'Untitled Workflow', description = '', projectId = null } = {}) {
  const fallback = () => {
    const list = loadWorkflows()
    const wf = {
      id: uid('wf'),
      name,
      description,
      status: 'draft',
      nodes: 1,
      runs: 0,
      passRate: 0,
      errorRate: 0,
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      graph: starterGraph(),
    }
    list.unshift(wf)
    saveWorkflows(list)
    return wf
  }
  return request('/workflows', { method: 'post', data: { name, description, projectId }, fallback })
}

export async function updateWorkflow(id, patch = {}) {
  const fallback = () => {
    const list = loadWorkflows()
    const idx = list.findIndex((w) => w.id === id)
    if (idx === -1) return null
    list[idx] = { ...list[idx], ...patch, updatedAt: new Date().toISOString() }
    saveWorkflows(list)
    return list[idx]
  }
  return request(`/workflows/${id}`, { method: 'patch', data: patch, fallback })
}

export async function saveGraph(id, graph) {
  const fallback = () => {
    const list = loadWorkflows()
    const idx = list.findIndex((w) => w.id === id)
    if (idx === -1) return null
    list[idx] = {
      ...list[idx],
      graph,
      nodes: graph?.nodes?.length ?? list[idx].nodes,
      updatedAt: new Date().toISOString(),
    }
    saveWorkflows(list)
    return list[idx]
  }
  await delay(320) // surface the loading state honestly
  return request(`/workflows/${id}/graph`, { method: 'put', data: graph, fallback })
}

export async function publishWorkflow(id) {
  const fallback = () => {
    const list = loadWorkflows()
    const idx = list.findIndex((w) => w.id === id)
    if (idx === -1) return null
    list[idx] = { ...list[idx], status: 'active', updatedAt: new Date().toISOString() }
    saveWorkflows(list)
    return list[idx]
  }
  await delay(420)
  // Real publishing must be confirmed by the backend/engine; the mock clearly can't.
  return request(`/workflows/${id}/publish`, { method: 'post', fallback })
}

export async function deleteWorkflow(id) {
  const fallback = () => {
    const list = loadWorkflows().filter((w) => w.id !== id)
    saveWorkflows(list)
    return { ok: true }
  }
  return request(`/workflows/${id}`, { method: 'delete', fallback })
}

export async function resetDemoData() {
  return resetWorkflows()
}
