import { registerNode } from '../registry'
import type { NodeDefinition } from '../types'
import { isPlainObject, line, safeJsonParse, toNumber } from './helpers'

interface KeyValue {
  key: string
  value: string
}

const httpRequest: NodeDefinition = {
  type: 'http_request',
  label: 'HTTP Request',
  category: 'action',
  icon: 'Globe',
  description:
    'Calls an HTTP endpoint with a timeout and error handling. Runs from the browser, so CORS rules apply.',
  hasInput: true,
  defaultConfig: {
    method: 'GET',
    url: 'https://api.github.com/repos/facebook/react',
    headers: [{ key: 'Accept', value: 'application/json' }],
    bodyJson: '',
    timeoutMs: 10000,
    failOnError: true,
  },
  fields: [
    {
      key: 'method',
      label: 'Method',
      type: 'select',
      options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({ value: m, label: m })),
    },
    { key: 'url', label: 'URL', type: 'text', wide: true, help: 'Templates are supported.' },
    { key: 'headers', label: 'Headers', type: 'keyvalue', wide: true },
    { key: 'bodyJson', label: 'Body (JSON)', type: 'json', wide: true, help: 'Ignored for GET/HEAD.' },
    { key: 'timeoutMs', label: 'Timeout (ms)', type: 'number' },
    { key: 'failOnError', label: 'Fail the workflow on a non-2xx response', type: 'boolean' },
  ],
  outputs: [{ id: 'out', label: 'Response' }],
  execute: async ({ config, resolve, signal }) => {
    const method = String(config?.method ?? 'GET').toUpperCase()
    const url = String(resolve(config?.url ?? '')).trim()
    if (!url) throw new Error('HTTP Request needs a URL.')

    const headerPairs: KeyValue[] = Array.isArray(config?.headers) ? config.headers : []
    const headers: Record<string, string> = {}
    for (const h of headerPairs) if (h?.key) headers[h.key] = String(resolve(h.value ?? ''))

    let bodyText: string | undefined
    if (method !== 'GET' && method !== 'HEAD' && config?.bodyJson) {
      const resolved = resolve(config.bodyJson)
      let value: any = resolved
      if (typeof resolved === 'string') {
        const parsed = safeJsonParse(resolved)
        value = parsed.ok ? parsed.value : resolved
      }
      bodyText = typeof value === 'string' ? value : JSON.stringify(value)
      if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
        headers['Content-Type'] = 'application/json'
      }
    }

    const timeoutMs = toNumber(config?.timeoutMs) ?? 10000
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const started = Date.now()

    try {
      const response = await fetch(url, { method, headers, body: bodyText, signal: controller.signal })
      const contentType = response.headers.get('content-type') ?? ''
      let data: any
      if (contentType.includes('application/json')) {
        data = await response.json().catch(() => null)
      } else {
        data = await response.text()
      }
      const ok = response.ok
      if (!ok && config?.failOnError !== false) {
        throw new Error(`HTTP ${response.status} ${response.statusText} from ${url}`)
      }
      return {
        output: {
          status: response.status,
          ok,
          url,
          durationMs: Date.now() - started,
          data,
        },
        logs: [line(ok ? 'success' : 'warn', `${method} ${url} → ${response.status}`)],
      }
    } catch (error: any) {
      if (error?.name === 'AbortError' || signal.aborted) {
        throw new Error(`Request to ${url} timed out after ${timeoutMs}ms.`)
      }
      const message = error?.message ?? 'Request failed.'
      const hint = /failed to fetch|networkerror|load failed/i.test(message)
        ? ' This is usually a network error or a CORS block on the target server.'
        : ''
      throw new Error(`${message}${hint}`)
    } finally {
      clearTimeout(timer)
    }
  },
  validateConfig: (config) => {
    const errors: string[] = []
    if (!config?.url) errors.push('A URL is required.')
    const timeout = toNumber(config?.timeoutMs)
    if (timeout !== undefined && timeout <= 0) errors.push('Timeout must be a positive number.')
    if (config?.bodyJson) {
      const parsed = safeJsonParse(resolveLiteral(config.bodyJson))
      if (!parsed.ok) errors.push(`Body is not valid JSON: ${parsed.error}`)
    }
    return errors
  },
}

/** Validation-time helper: only parse JSON when the body has no templates. */
function resolveLiteral(value: string): string {
  return typeof value === 'string' && value.includes('{{') ? '' : value
}

const saveResult: NodeDefinition = {
  type: 'save_result',
  label: 'Save Result',
  category: 'action',
  icon: 'Save',
  description: 'Stores a value under a key so later nodes and the execution summary can read it.',
  hasInput: true,
  defaultConfig: { key: 'result', value: '{{input}}' },
  fields: [
    { key: 'key', label: 'Result key', type: 'text' },
    { key: 'value', label: 'Value', type: 'text', wide: true, help: 'Templates are supported.' },
  ],
  outputs: [{ id: 'out', label: 'Saved' }],
  execute: ({ config, input, context, resolve }) => {
    const key = String(config?.key ?? '').trim()
    if (!key) throw new Error('Save Result needs a key.')
    const value = resolve(config?.value ?? '{{input}}')
    context.saved[key] = value
    return {
      output: { ...(isPlainObject(input) ? input : {}), savedKey: key, savedValue: value },
      logs: [line('success', `Saved result "${key}".`)],
    }
  },
  validateConfig: (config) => (config?.key ? [] : ['Save Result needs a key.']),
}

const notify: NodeDefinition = {
  type: 'notify',
  label: 'Send Notification',
  category: 'action',
  icon: 'Bell',
  description:
    'Delivers a notification through a demo adapter (email or Slack style). Wire a real provider to go live.',
  hasInput: true,
  demoOnly: true,
  defaultConfig: {
    channel: 'demo-email',
    to: '{{input.email}}',
    subject: 'Workflow notification',
    body: 'Hello {{input.name}}, your workflow finished successfully.',
  },
  fields: [
    {
      key: 'channel',
      label: 'Channel',
      type: 'select',
      options: [
        { value: 'demo-email', label: 'Email (demo adapter)' },
        { value: 'demo-slack', label: 'Slack (demo adapter)' },
      ],
    },
    { key: 'to', label: 'To', type: 'text' },
    { key: 'subject', label: 'Subject', type: 'text' },
    { key: 'body', label: 'Message', type: 'textarea', wide: true, help: 'Templates are supported.' },
  ],
  outputs: [{ id: 'out', label: 'Delivery' }],
  execute: ({ config, resolve, context }) => {
    const channel = String(config?.channel ?? 'demo-email')
    const record = {
      ts: Date.now(),
      channel,
      to: String(resolve(config?.to ?? '')),
      subject: String(resolve(config?.subject ?? '')),
      body: String(resolve(config?.body ?? '')),
      transport: 'demo' as const,
    }
    context.notifications.push(record)
    return {
      output: { delivered: true, transport: 'demo', channel, to: record.to, subject: record.subject },
      logs: [line('success', `Demo ${channel} notification sent to "${record.to}".`)],
    }
  },
  validateConfig: (config) => (config?.to ? [] : ['A recipient is required.']),
}

registerNode(httpRequest)
registerNode(saveResult)
registerNode(notify)
