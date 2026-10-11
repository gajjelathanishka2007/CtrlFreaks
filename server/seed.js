/**
 * Server-side seed data.
 * Re-exports the shared demo dataset (pure JS, no browser dependencies) so the
 * API and the frontend mock layer stay in sync.
 */
export {
  demoWorkflows,
  demoExecutions,
  demoScenarios,
  demoContractIssues,
  demoActivity,
  demoStats,
} from '../src/data/mock.js'

/** Integration catalog (kept server-side to avoid importing React icons). */
export const integrationSeed = [
  { key: 'app.github', name: 'GitHub', requiresCredentials: 'github', connected: false },
  { key: 'app.gmail', name: 'Gmail', requiresCredentials: 'google', connected: false },
  { key: 'app.gsheets', name: 'Google Sheets', requiresCredentials: 'google', connected: false },
  { key: 'app.slack', name: 'Slack', requiresCredentials: 'slack', connected: false },
  { key: 'app.webhook', name: 'Webhook', requiresCredentials: null, connected: false },
  { key: 'app.http', name: 'HTTP Request', requiresCredentials: null, connected: false },
  { key: 'app.database', name: 'Database', requiresCredentials: null, connected: false },
  { key: 'app.schedule', name: 'Schedule', requiresCredentials: null, connected: false },
]
