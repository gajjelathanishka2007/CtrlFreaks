import { request } from './api.js'
import { NODE_CATALOG } from '../data/nodeCatalog.js'

/**
 * Integration service.
 * Backend routes (server/routes/integrations.js):
 *   GET  /integrations
 *   POST /integrations/:id/connect
 *
 * IMPORTANT: nothing is ever reported as "connected" until a real backend
 * connection succeeds. Credentials are sent to the backend only — never stored
 * in the browser or in source.
 */

export async function listIntegrations() {
  return request('/integrations', {
    fallback: () =>
      NODE_CATALOG.filter((n) => n.isIntegration).map((n) => ({
        id: n.id,
        name: n.name,
        category: n.category,
        requiresCredentials: n.requiresCredentials || null,
        connected: false,
      })),
  })
}

export async function connectIntegration(id, credentials = {}) {
  // In mock mode we must NOT claim a real connection.
  return request(`/integrations/${id}/connect`, {
    method: 'post',
    data: credentials,
    fallback: () => ({
      ok: false,
      connected: false,
      reason: 'no-backend',
      message: 'Integration connections require the Synq backend and OAuth credentials. This is a demo action.',
    }),
  })
}
