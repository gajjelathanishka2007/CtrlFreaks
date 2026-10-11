import { request, delay } from './api.js'
import { demoScenarios } from '../data/mock.js'
import { simulateWorkflow } from './simulationEngine.js'

/**
 * Simulation service (Flight Simulator).
 * Backend route: POST /simulations
 *
 * Scenarios are deterministic by default. When the team's automation engine is
 * connected, the backend can run them instead and return the same shape.
 */

export async function getScenarios() {
  return request('/simulations/scenarios', { fallback: () => demoScenarios })
}

export async function runSimulation(workflow, scenarioIds = []) {
  await delay(500)
  const fallback = () => {
    const scenarios = demoScenarios.filter(
      (s) => !scenarioIds.length || scenarioIds.includes(s.id),
    )
    return simulateWorkflow(workflow, scenarios)
  }
  return request('/simulations', { method: 'post', data: { workflowId: workflow?.id, scenarioIds }, fallback })
}
