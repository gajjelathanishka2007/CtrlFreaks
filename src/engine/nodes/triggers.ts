import { registerNode } from '../registry'
import type { NodeDefinition } from '../types'
import { line, safeJsonParse } from './helpers'

const manualTrigger: NodeDefinition = {
  type: 'manual_trigger',
  label: 'Manual Trigger',
  category: 'trigger',
  icon: 'Play',
  description: 'Starts the workflow with a payload you provide when you press Run.',
  isTrigger: true,
  hasInput: false,
  defaultConfig: {
    samplePayloadJson: '{\n  "name": "Ada Lovelace",\n  "email": "ada@example.com",\n  "amount": 250\n}',
  },
  fields: [
    {
      key: 'samplePayloadJson',
      label: 'Sample trigger payload (JSON)',
      type: 'json',
      wide: true,
      help: 'Used to pre-fill the Run dialog. The real payload is supplied at run time.',
    },
  ],
  outputs: [{ id: 'out', label: 'Payload' }],
  execute: ({ config, context }) => {
    const sample = safeJsonParse(config?.samplePayloadJson)
    const fallback = sample.ok ? sample.value : undefined
    const payload = context.trigger !== undefined ? context.trigger : fallback
    return {
      output: payload ?? {},
      logs: [line('info', 'Workflow started by manual trigger.')],
    }
  },
  validateConfig: (config) => {
    const errors: string[] = []
    const parsed = safeJsonParse(config?.samplePayloadJson)
    if (!parsed.ok) errors.push(`Sample payload is not valid JSON: ${parsed.error}`)
    return errors
  },
}

const webhookTrigger: NodeDefinition = {
  type: 'webhook_trigger',
  label: 'Webhook Trigger',
  category: 'trigger',
  icon: 'Webhook',
  description:
    'Simulates an inbound webhook call. Real webhooks need a server; this runs the configured sample payload.',
  isTrigger: true,
  hasInput: false,
  demoOnly: true,
  defaultConfig: {
    path: '/hooks/incoming',
    samplePayloadJson: '{\n  "event": "order.created",\n  "orderId": "ORD-1042"\n}',
  },
  fields: [
    { key: 'path', label: 'Webhook path', type: 'text', placeholder: '/hooks/incoming' },
    {
      key: 'samplePayloadJson',
      label: 'Sample payload (JSON)',
      type: 'json',
      wide: true,
      help: 'Demo adapter: this payload is used in place of a live HTTP delivery.',
    },
  ],
  outputs: [{ id: 'out', label: 'Payload' }],
  execute: ({ config, context }) => {
    const sample = safeJsonParse(config?.samplePayloadJson)
    const payload = context.trigger !== undefined ? context.trigger : sample.ok ? sample.value : {}
    return {
      output: payload ?? {},
      logs: [
        line('warn', `Webhook trigger "${config?.path ?? '/hooks'}" is a demo adapter (no live HTTP listener).`),
      ],
    }
  },
  validateConfig: (config) => {
    const errors: string[] = []
    if (!config?.path) errors.push('Webhook path is required.')
    const parsed = safeJsonParse(config?.samplePayloadJson)
    if (!parsed.ok) errors.push(`Sample payload is not valid JSON: ${parsed.error}`)
    return errors
  },
}

registerNode(manualTrigger)
registerNode(webhookTrigger)
