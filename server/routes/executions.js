import { Router } from 'express'
import * as store from '../store.js'
import { ah } from './helpers.js'

const router = Router()

router.get(
  '/',
  ah(async (req, res) => {
    const { search = '', status = 'all', mode = 'all', page = 1, limit = 6 } = req.query
    res.json(await store.listExecutions({ search, status, mode, page, limit }))
  }),
)

router.get(
  '/:id',
  ah(async (req, res) => {
    const exec = await store.getExecution(req.params.id)
    if (!exec) return res.status(404).json({ error: 'Execution not found' })
    res.json(exec)
  }),
)

export default router
