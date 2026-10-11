import { Router } from 'express'
import * as store from '../store.js'
import { ah } from './helpers.js'
import { demoScenarios } from '../seed.js'
import { simulateWorkflow } from '../../src/services/simulationEngine.js'

const router = Router()

router.get(
  '/scenarios',
  ah(async (_req, res) => {
    res.json(demoScenarios)
  }),
)

router.post(
  '/',
  ah(async (req, res) => {
    const { workflowId, scenarioIds = [], graph } = req.body || {}

    let resolvedGraph = graph
    let workflowName = 'Workflow'
    const wf = workflowId ? await store.getWorkflow(workflowId) : null
    if (wf) {
      workflowName = wf.name
      if (!resolvedGraph) resolvedGraph = wf.graph
    }

    const scenarios = demoScenarios.filter((s) => !scenarioIds.length || scenarioIds.includes(s.id))
    const result = simulateWorkflow({ graph: resolvedGraph || { nodes: [], edges: [] } }, scenarios)

    // Persist a simulation record so it appears in Execution History (mode: simulation).
    const first = result.results[0]
    await store.saveSimulationRun({
      workflowId: workflowId || null,
      workflowName,
      trigger: 'Flight Simulator',
      status: first?.status === 'pass' ? 'success' : first?.status === 'warn' ? 'warning' : 'failed',
      mode: 'simulation',
      startedAt: new Date(),
      durationMs: first?.durationMs || 0,
      input: demoScenarios[0]?.input,
      logs: (first?.steps || []).map((s) => ({ node: s.nodeName, status: s.status, ms: s.ms, output: s.output, error: s.error, note: s.note })),
      actions: first?.actions || [],
      contractWarnings: first?.contractWarnings || [],
      failure: first?.failure || null,
    })

    res.json(result)
  }),
)

export default router
