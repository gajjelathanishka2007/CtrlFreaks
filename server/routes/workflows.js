import { Router } from 'express'
import * as store from '../store.js'
import { ah } from './helpers.js'

const router = Router()

router.get(
  '/',
  ah(async (_req, res) => {
    res.json(await store.listWorkflows())
  }),
)

router.get(
  '/:id',
  ah(async (req, res) => {
    const wf = await store.getWorkflow(req.params.id)
    if (!wf) return res.status(404).json({ error: 'Workflow not found' })
    res.json(wf)
  }),
)

router.post(
  '/',
  ah(async (req, res) => {
    const wf = await store.createWorkflow(req.body || {})
    res.status(201).json(wf)
  }),
)

router.patch(
  '/:id',
  ah(async (req, res) => {
    const wf = await store.updateWorkflow(req.params.id, req.body || {})
    if (!wf) return res.status(404).json({ error: 'Workflow not found' })
    res.json(wf)
  }),
)

router.put(
  '/:id/graph',
  ah(async (req, res) => {
    const wf = await store.saveGraph(req.params.id, req.body || { nodes: [], edges: [] })
    if (!wf) return res.status(404).json({ error: 'Workflow not found' })
    res.json(wf)
  }),
)

router.post(
  '/:id/publish',
  ah(async (req, res) => {
    // Real publishing must be confirmed by the automation engine. Wire that
    // confirmation in here before flipping status to 'active'.
    const wf = await store.publishWorkflow(req.params.id)
    if (!wf) return res.status(404).json({ error: 'Workflow not found' })
    res.json({ ...wf, engineConfirmed: false })
  }),
)

router.delete(
  '/:id',
  ah(async (req, res) => {
    res.json(await store.deleteWorkflow(req.params.id))
  }),
)

export default router
