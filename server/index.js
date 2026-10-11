import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { connectDb } from './db.js'
import { initStore, getBackend } from './store.js'
import workflowsRouter from './routes/workflows.js'
import executionsRouter from './routes/executions.js'
import dashboardRouter from './routes/dashboard.js'
import integrationsRouter from './routes/integrations.js'
import simulationsRouter from './routes/simulations.js'
import aiRouter from './routes/ai.js'
import codeRouter from './routes/code.js'

const app = express()

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  }),
)
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'synq-api',
    store: getBackend(),
    ai: Boolean(process.env.OPENAI_API_KEY),
    time: new Date().toISOString(),
  })
})

app.use('/api/workflows', workflowsRouter)
app.use('/api/executions', executionsRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/integrations', integrationsRouter)
app.use('/api/simulations', simulationsRouter)
app.use('/api/ai', aiRouter)
app.use('/api/code', codeRouter)

app.use((_req, res) => res.status(404).json({ error: 'Not found' }))
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[synq-api] Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

const PORT = process.env.PORT || 5000

const db = await connectDb()
await initStore(db)

app.listen(PORT, () => {
  console.log(`[synq-api] Listening on http://localhost:${PORT}/api`)
  console.log(`[synq-api] Store: ${getBackend()} · AI: ${process.env.OPENAI_API_KEY ? 'configured' : 'demo'}`)
})
