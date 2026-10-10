import { buildWorkflow, type EdgeSpec, type NodeSpec } from '../lib/blueprint'
import type { Workflow } from '../types/workflow'

export interface TemplateDefinition {
  id: string
  name: string
  tagline: string
  description: string
  tags: string[]
  build: () => Workflow
}

const leadQualification: TemplateDefinition = {
  id: 'tpl_lead',
  name: 'Lead Qualification',
  tagline: 'Validate, score and route an inbound lead',
  description:
    'Validates a lead’s contact details, normalises the data, and only notifies the sales channel when the deal is above a threshold. Includes a rejected branch.',
  tags: ['Validate', 'Condition', 'Notify'],
  build: () => {
    const specs: NodeSpec[] = [
      {
        type: 'manual_trigger',
        name: 'Lead received',
        config: {
          samplePayloadJson:
            '{\n  "name": "  Ada Lovelace  ",\n  "email": "ADA@Example.COM",\n  "amount": 250\n}',
        },
      },
      {
        type: 'validate_input',
        name: 'Check contact details',
        config: {
          rules: [
            { field: 'email', required: true, type: 'email', message: 'A valid email is required.' },
            { field: 'name', required: true, type: 'string' },
          ],
          onInvalid: 'branch',
        },
      },
      {
        type: 'transform',
        name: 'Normalise lead',
        config: {
          fields: [
            { key: 'name', value: '{{input.name}}', op: 'trim' },
            { key: 'email', value: '{{input.email}}', op: 'lower' },
            { key: 'amount', value: '{{input.amount}}', op: 'number' },
          ],
        },
      },
      {
        type: 'condition',
        name: 'Worth pursuing?',
        config: {
          logic: 'and',
          rules: [{ left: '{{input.amount}}', operator: 'greaterThan', right: '100' }],
        },
      },
      { type: 'save_result', name: 'Record qualified lead', config: { key: 'qualifiedLead', value: '{{input.email}}' } },
      {
        type: 'notify',
        name: 'Notify sales',
        config: {
          channel: 'demo-email',
          to: 'sales@ctrlfreaks.demo',
          subject: 'New qualified lead: {{input.name}}',
          body: 'A lead worth {{input.amount}} is ready for follow-up.',
        },
      },
      { type: 'log_output', name: 'Done (qualified)', config: { level: 'success', message: 'Qualified lead saved as {{saved.qualifiedLead}}' } },
      {
        type: 'log_output',
        name: 'Rejected',
        config: { level: 'warn', message: 'Lead below threshold — no notification sent.' },
      },
    ]
    const edges: EdgeSpec[] = [
      { from: 0, port: 'out', to: 1 },
      { from: 1, port: 'valid', to: 2 },
      { from: 2, port: 'out', to: 3 },
      { from: 3, port: 'true', to: 4 },
      { from: 4, port: 'out', to: 5 },
      { from: 5, port: 'out', to: 6 },
      { from: 3, port: 'false', to: 7 },
    ]
    return buildWorkflow(
      'Lead Qualification',
      'Validates, normalises and routes an inbound lead by deal size.',
      specs,
      edges,
      'wf_template_lead',
    )
  },
}

const ticketTriage: TemplateDefinition = {
  id: 'tpl_triage',
  name: 'Support Ticket Triage',
  tagline: 'AI classifies the ticket, then routes it',
  description:
    'Uses the AI Transform node to classify a support ticket, then a Switch node routes it to the right team. Runs on the demo AI adapter with no key required.',
  tags: ['AI', 'Switch', 'Notify'],
  build: () => {
    const specs: NodeSpec[] = [
      {
        type: 'manual_trigger',
        name: 'Ticket received',
        config: {
          samplePayloadJson:
            '{\n  "customer": "Grace Hopper",\n  "subject": "Refund needed",\n  "body": "I was double charged on my last invoice and need a refund please."\n}',
        },
      },
      {
        type: 'ai_transform',
        name: 'Classify ticket',
        config: {
          instruction: 'Classify the support ticket and return JSON with a "category" field (billing, technical, sales or general).',
          payload: '{{input.body}}',
        },
      },
      {
        type: 'switch',
        name: 'Route by category',
        config: {
          field: '{{input.category}}',
          cases: [
            { value: 'billing', label: 'Billing' },
            { value: 'technical', label: 'Technical' },
            { value: 'sales', label: 'Sales' },
          ],
          defaultLabel: 'General',
        },
      },
      {
        type: 'notify',
        name: 'Billing team',
        config: { channel: 'demo-email', to: 'billing@ctrlfreaks.demo', subject: 'Billing ticket: {{trigger.subject}}', body: '{{trigger.body}}' },
      },
      {
        type: 'notify',
        name: 'Engineering team',
        config: { channel: 'demo-slack', to: '#engineering', subject: 'Technical ticket: {{trigger.subject}}', body: '{{trigger.body}}' },
      },
      {
        type: 'notify',
        name: 'Sales team',
        config: { channel: 'demo-email', to: 'sales@ctrlfreaks.demo', subject: 'Sales enquiry: {{trigger.subject}}', body: '{{trigger.body}}' },
      },
      { type: 'log_output', name: 'General queue', config: { level: 'info', message: 'Ticket routed to the general queue: {{trigger.subject}}' } },
    ]
    const edges: EdgeSpec[] = [
      { from: 0, port: 'out', to: 1 },
      { from: 1, port: 'out', to: 2 },
      { from: 2, port: 'case_0', to: 3 },
      { from: 2, port: 'case_1', to: 4 },
      { from: 2, port: 'case_2', to: 5 },
      { from: 2, port: 'default', to: 6 },
    ]
    return buildWorkflow(
      'Support Ticket Triage',
      'AI classifies and routes support tickets to the right team.',
      specs,
      edges,
      'wf_template_triage',
    )
  },
}

const orderProcessing: TemplateDefinition = {
  id: 'tpl_order',
  name: 'Order Processing',
  tagline: 'Enrich an order and confirm by email',
  description:
    'Sets a status field, calls a live public API over HTTP, saves the response code, and sends a confirmation. The HTTP step needs an internet connection and a CORS-friendly endpoint.',
  tags: ['HTTP', 'Save', 'Notify'],
  build: () => {
    const specs: NodeSpec[] = [
      {
        type: 'manual_trigger',
        name: 'Order received',
        config: {
          samplePayloadJson: '{\n  "orderId": "ORD-1042",\n  "quantity": 3,\n  "email": "buyer@example.com"\n}',
        },
      },
      {
        type: 'set_value',
        name: 'Mark as processing',
        config: { fields: [{ key: 'status', value: 'processing' }], mergeInput: true },
      },
      {
        type: 'http_request',
        name: 'Check service health',
        config: {
          method: 'GET',
          url: 'https://api.github.com/zen',
          headers: [{ key: 'Accept', value: 'application/json' }],
          timeoutMs: 10000,
          failOnError: false,
        },
      },
      { type: 'save_result', name: 'Save HTTP status', config: { key: 'httpStatus', value: '{{input.status}}' } },
      {
        type: 'notify',
        name: 'Confirm to buyer',
        config: {
          channel: 'demo-email',
          to: '{{trigger.email}}',
          subject: 'Order {{trigger.orderId}} received',
          body: 'Thanks! We are processing order {{trigger.orderId}}.',
        },
      },
      {
        type: 'log_output',
        name: 'Summary',
        config: { level: 'success', message: 'Order {{trigger.orderId}} processed. Health check returned {{saved.httpStatus}}.' },
      },
    ]
    const edges: EdgeSpec[] = [
      { from: 0, port: 'out', to: 1 },
      { from: 1, port: 'out', to: 2 },
      { from: 2, port: 'out', to: 3 },
      { from: 3, port: 'out', to: 4 },
      { from: 4, port: 'out', to: 5 },
    ]
    return buildWorkflow(
      'Order Processing',
      'Enriches an order, calls an external API and confirms by email.',
      specs,
      edges,
      'wf_template_order',
    )
  },
}

export const TEMPLATES: TemplateDefinition[] = [leadQualification, ticketTriage, orderProcessing]
