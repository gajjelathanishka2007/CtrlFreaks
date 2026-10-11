import { Router } from 'express'
import * as store from '../store.js'
import { ah } from './helpers.js'
import { demoStats, demoActivity } from '../seed.js'

const router = Router()

router.get(
  '/stats',
  ah(async (_req, res) => {
    const workflows = await store.listWorkflows()
    const executions = await store.listExecutions({ limit: 4 })
    res.json({
      stats: { ...demoStats, totalWorkflows: workflows.length },
      recentWorkflows: executions.items,
      activity: demoActivity,
    })
  }),
)

export default router
