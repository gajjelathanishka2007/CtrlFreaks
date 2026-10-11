import { Router } from 'express'
import * as store from '../store.js'
import { ah } from './helpers.js'

const router = Router()

router.get(
  '/',
  ah(async (_req, res) => {
    res.json(await store.listIntegrations())
  }),
)

router.post(
  '/:id/connect',
  ah(async (req, res) => {
    // NOTE: never store secrets returned to the client. A real implementation
    // starts an OAuth flow and stores tokens server-side.
    res.json(await store.connectIntegration(req.params.id))
  }),
)

export default router
