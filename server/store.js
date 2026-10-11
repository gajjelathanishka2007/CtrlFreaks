import { randomUUID } from 'node:crypto'
import Workflow from './models/Workflow.js'
import Execution from './models/Execution.js'
import Integration from './models/Integration.js'
import { demoWorkflows, demoExecutions, integrationSeed } from './seed.js'

/**
 * Data store with two backends:
 *   - 'mongo'  : MongoDB via Mongoose (when MONGODB_URI is reachable)
 *   - 'memory' : seeded in-memory arrays (development fallback)
 * Both expose the same interface so routes never branch.
 */

let backend = 'memory'
const mem = { workflows: [], executions: [], integrations: [] }

const clone = (v) => JSON.parse(JSON.stringify(v))

function starterGraph() {
  return {
    nodes: [
      {
        id: `n_${randomUUID().slice(0, 8)}`,
        type: 'start',
        position: { x: 120, y: 200 },
        data: { catalogId: 'trigger.start', label: 'Start', config: { label: 'Manual start', payload: '{}' } },
      },
    ],
    edges: [],
  }
}

export async function initStore(db) {
  if (db) {
    backend = 'mongo'
    if ((await Workflow.countDocuments()) === 0) {
      await Workflow.insertMany(
        demoWorkflows.map(({ id, ...w }) => ({
          ...w,
          name: w.name,
        })),
      )
    }
    if ((await Execution.countDocuments()) === 0) {
      await Execution.insertMany(demoExecutions.map(({ id, ...e }) => ({ ...e, execId: id })))
    }
    if ((await Integration.countDocuments()) === 0) {
      await Integration.insertMany(integrationSeed)
    }
    console.log('[synq-api] Store ready (mongo).')
  } else {
    backend = 'memory'
    mem.workflows = demoWorkflows.map((w) => ({ ...clone(w), id: w.id }))
    mem.executions = demoExecutions.map((e) => ({ ...clone(e), id: e.id }))
    mem.integrations = integrationSeed.map((i) => ({ ...clone(i), id: i.key }))
    console.log('[synq-api] Store ready (memory).')
  }
  return backend
}

export const getBackend = () => backend

/* ------------------------------- workflows ------------------------------- */

export async function listWorkflows() {
  if (backend === 'mongo') return (await Workflow.find().sort({ updatedAt: -1 }).lean({ virtuals: false })).map(withId)
  return mem.workflows
}

export async function getWorkflow(id) {
  if (backend === 'mongo') {
    try {
      const doc = await Workflow.findById(id)
      return doc ? doc.toJSON() : null
    } catch {
      return null
    }
  }
  return mem.workflows.find((w) => w.id === id) || null
}

export async function createWorkflow({ name, description = '', projectId = null }) {
  const payload = {
    name: name || 'Untitled Workflow',
    description,
    projectId,
    status: 'draft',
    nodes: 1,
    runs: 0,
    passRate: 0,
    errorRate: 0,
    graph: starterGraph(),
  }
  if (backend === 'mongo') return (await Workflow.create(payload)).toJSON()
  const wf = { ...payload, id: `wf_${randomUUID().slice(0, 8)}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  mem.workflows.unshift(wf)
  return wf
}

export async function updateWorkflow(id, patch) {
  const safe = { ...patch }
  delete safe.id
  if (backend === 'mongo') {
    try {
      const doc = await Workflow.findByIdAndUpdate(id, safe, { new: true })
      return doc ? doc.toJSON() : null
    } catch {
      return null
    }
  }
  const idx = mem.workflows.findIndex((w) => w.id === id)
  if (idx === -1) return null
  mem.workflows[idx] = { ...mem.workflows[idx], ...safe, updatedAt: new Date().toISOString() }
  return mem.workflows[idx]
}

export async function saveGraph(id, graph) {
  const patch = { graph, nodes: graph?.nodes?.length ?? 0 }
  return updateWorkflow(id, patch)
}

export async function publishWorkflow(id) {
  return updateWorkflow(id, { status: 'active' })
}

export async function deleteWorkflow(id) {
  if (backend === 'mongo') {
    try {
      await Workflow.findByIdAndDelete(id)
    } catch {
      /* ignore */
    }
    return { ok: true }
  }
  mem.workflows = mem.workflows.filter((w) => w.id !== id)
  return { ok: true }
}

/* ------------------------------- executions ------------------------------ */

function withId(doc) {
  const o = doc.toObject ? doc.toObject() : { ...doc }
  o.id = o._id?.toString() || o.id
  delete o._id
  delete o.__v
  return o
}

export async function listExecutions({ search = '', status = 'all', mode = 'all', page = 1, limit = 6 } = {}) {
  page = Number(page) || 1
  limit = Number(limit) || 6

  let rows
  if (backend === 'mongo') {
    rows = (await Execution.find().sort({ startedAt: -1 }).lean()).map((r) => ({ ...r, id: r.execId }))
  } else {
    rows = mem.executions
  }

  let filtered = rows
  if (search) {
    const q = String(search).toLowerCase()
    filtered = filtered.filter(
      (r) =>
        (r.workflowName || '').toLowerCase().includes(q) ||
        (r.id || '').toLowerCase().includes(q) ||
        (r.trigger || '').toLowerCase().includes(q),
    )
  }
  if (status !== 'all') filtered = filtered.filter((r) => r.status === status)
  if (mode !== 'all') filtered = filtered.filter((r) => r.mode === mode)

  const total = filtered.length
  const start = (page - 1) * limit
  return { items: filtered.slice(start, start + limit), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) }
}

export async function getExecution(id) {
  if (backend === 'mongo') {
    const r = await Execution.findOne({ execId: id }).lean()
    return r ? { ...r, id: r.execId } : null
  }
  return mem.executions.find((e) => e.id === id) || null
}

export async function saveSimulationRun(record) {
  if (backend === 'mongo') {
    const doc = await Execution.create(record)
    return doc.toJSON()
  }
  const execId = record.execId || `SIM-${randomUUID().slice(0, 6).toUpperCase()}`
  const row = { ...record, id: execId, execId }
  mem.executions.unshift(row)
  return row
}

/* ------------------------------ integrations ----------------------------- */

export async function listIntegrations() {
  if (backend === 'mongo') return (await Integration.find().lean()).map((i) => ({ ...i, id: i.key }))
  return mem.integrations.map((i) => ({ id: i.id, name: i.name, requiresCredentials: i.requiresCredentials, connected: i.connected }))
}

export async function connectIntegration(key) {
  // A real connection requires OAuth/credentials handled server-side.
  // Until that flow exists we must NOT report success.
  return {
    ok: false,
    connected: false,
    reason: 'oauth-not-configured',
    message:
      'Live integration connections require OAuth credentials configured on the server. This endpoint is ready to wire up.',
  }
}
