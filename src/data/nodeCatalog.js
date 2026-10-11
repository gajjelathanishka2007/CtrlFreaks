/**
 * Synq node catalog
 * -----------------
 * Single source of truth for every node/integration that can be placed on the
 * workflow canvas. Drives three things:
 *   1. The React Flow custom node visuals (name, category, accent, description).
 *   2. The bottom-center "Add Node / Integration" searchable picker.
 *   3. The node configuration panel (fields + defaults).
 *
 * Adding a node here automatically makes it available everywhere.
 */
import {
  Play,
  ClipboardList,
  Webhook,
  Table2,
  CalendarClock,
  ShieldCheck,
  GitBranch,
  Filter,
  CopyCheck,
  FileCheck2,
  Mail,
  Bell,
  Globe,
  Database,
  Braces,
  Terminal,
  Code2,
  Sparkles,
  Shuffle,
  Wand2,
  Type,
  GitMerge,
  Github,
  Slack,
  Clock,
  Layers,
} from 'lucide-react'

/** Visual accent tokens (kept in sync with the Tailwind theme). */
export const ACCENTS = {
  blue: {
    text: 'text-electric',
    bg: 'bg-electric/10',
    border: 'border-electric/40',
    dot: 'bg-electric',
    soft: 'bg-electric/15',
    hex: '#3B82F6',
  },
  green: {
    text: 'text-neon',
    bg: 'bg-neon/10',
    border: 'border-neon/40',
    dot: 'bg-neon',
    soft: 'bg-neon/15',
    hex: '#19E68C',
  },
  violet: {
    text: 'text-violet',
    bg: 'bg-violet/10',
    border: 'border-violet/40',
    dot: 'bg-violet',
    soft: 'bg-violet/15',
    hex: '#A78BFA',
  },
  red: {
    text: 'text-error',
    bg: 'bg-error/10',
    border: 'border-error/40',
    dot: 'bg-error',
    soft: 'bg-error/15',
    hex: '#F87171',
  },
}

/** Category metadata used for grouping + legend. */
export const NODE_CATEGORIES = [
  { id: 'trigger', label: 'Triggers', accent: 'blue', description: 'Start a workflow' },
  { id: 'logic', label: 'Logic', accent: 'violet', description: 'Branch, validate, filter' },
  { id: 'action', label: 'Actions', accent: 'green', description: 'Talk to other apps' },
  { id: 'code', label: 'Code', accent: 'blue', description: 'Custom + AI code' },
  { id: 'transform', label: 'Data transformation', accent: 'violet', description: 'Reshape data' },
]

/** Picker tabs (bottom-center Add Node popover). */
export const PICKER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'apps', label: 'Apps' },
  { id: 'ai', label: 'AI' },
  { id: 'code', label: 'Code' },
  { id: 'database', label: 'Database' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'logic', label: 'Logic' },
  { id: 'triggers', label: 'Triggers' },
]

const f = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra })

/**
 * The catalog. `type` is the React Flow node type key.
 */
export const NODE_CATALOG = [
  /* ------------------------------- TRIGGERS ------------------------------ */
  {
    id: 'trigger.start',
    type: 'start',
    name: 'Start',
    category: 'trigger',
    accent: 'blue',
    icon: Play,
    description: 'Manual entry point for testing and running the workflow.',
    tabs: ['triggers'],
    inputs: [],
    outputs: [{ name: 'payload', type: 'object' }],
    fields: [
      f('label', 'Start label', 'text', { placeholder: 'Manual start' }),
      f('payload', 'Sample payload (JSON)', 'textarea', {
        placeholder: '{\n  "first_name": "Ada",\n  "email": "ada@example.com"\n}',
      }),
    ],
    defaultConfig: { label: 'Manual start', payload: '{\n  "first_name": "Ada",\n  "last_name": "Lovelace",\n  "email": "ada@example.com"\n}' },
  },
  {
    id: 'trigger.form',
    type: 'formSubmitted',
    name: 'Form Submitted',
    category: 'trigger',
    accent: 'blue',
    icon: ClipboardList,
    description: 'Trigger when a Synq form or embedded form is submitted.',
    tabs: ['triggers', 'apps'],
    inputs: [],
    outputs: [
      { name: 'form_data', type: 'object', required: true },
      { name: 'submitted_at', type: 'string' },
    ],
    fields: [
      f('formId', 'Form', 'select', { options: ['Lead intake', 'Support request', 'Newsletter signup'], required: true }),
      f('includeMeta', 'Include submission metadata', 'boolean'),
    ],
    defaultConfig: { formId: 'Lead intake', includeMeta: true },
  },
  {
    id: 'trigger.webhook',
    type: 'webhookReceived',
    name: 'Webhook Received',
    category: 'trigger',
    accent: 'blue',
    icon: Webhook,
    description: 'Start the workflow when an inbound HTTP webhook fires.',
    tabs: ['triggers', 'apps'],
    inputs: [],
    outputs: [
      { name: 'payload', type: 'object', required: true },
      { name: 'headers', type: 'object' },
    ],
    fields: [
      f('path', 'Webhook path', 'text', { required: true, placeholder: '/hooks/lead-capture' }),
      f('method', 'Method', 'select', { options: ['POST', 'PUT', 'PATCH', 'GET'] }),
      f('secret', 'Signing secret (stored on backend)', 'text', {
        placeholder: 'Configured server-side — never stored in the browser',
      }),
    ],
    defaultConfig: { path: '/hooks/lead-capture', method: 'POST', secret: '' },
  },
  {
    id: 'trigger.sheetRow',
    type: 'newSheetRow',
    name: 'New Sheet Row',
    category: 'trigger',
    accent: 'blue',
    icon: Table2,
    description: 'Trigger when a row is added to a connected spreadsheet.',
    tabs: ['triggers', 'apps', 'productivity'],
    requiresCredentials: 'google',
    inputs: [],
    outputs: [
      { name: 'row', type: 'object', required: true },
      { name: 'row_number', type: 'number' },
    ],
    fields: [
      f('spreadsheet', 'Spreadsheet', 'text', { required: true, placeholder: 'Leads 2026' }),
      f('worksheet', 'Worksheet', 'text', { placeholder: 'Sheet1' }),
    ],
    defaultConfig: { spreadsheet: '', worksheet: 'Sheet1' },
  },
  {
    id: 'trigger.schedule',
    type: 'scheduleTrigger',
    name: 'Schedule Trigger',
    category: 'trigger',
    accent: 'blue',
    icon: CalendarClock,
    description: 'Run on a recurring schedule (cron).',
    tabs: ['triggers', 'apps'],
    inputs: [],
    outputs: [{ name: 'run_at', type: 'string' }],
    fields: [
      f('frequency', 'Frequency', 'select', { options: ['Every 5 minutes', 'Hourly', 'Daily', 'Weekly', 'Custom cron'] }),
      f('cron', 'Cron expression', 'text', { placeholder: '0 9 * * 1-5' }),
      f('timezone', 'Timezone', 'text', { placeholder: 'UTC' }),
    ],
    defaultConfig: { frequency: 'Daily', cron: '0 9 * * 1-5', timezone: 'UTC' },
  },

  /* -------------------------------- LOGIC -------------------------------- */
  {
    id: 'logic.validate',
    type: 'validateData',
    name: 'Validate Data',
    category: 'logic',
    accent: 'violet',
    icon: ShieldCheck,
    description: 'Check required fields, types, and formats before continuing.',
    tabs: ['logic'],
    inputs: [{ name: 'data', type: 'object', required: true }],
    outputs: [
      { name: 'valid', type: 'boolean' },
      { name: 'errors', type: 'array' },
    ],
    fields: [
      f('rules', 'Validation rules', 'keyvalue', {
        help: 'field → rule (required, email, number, min:3 …)',
      }),
    ],
    defaultConfig: {
      rules: [
        { key: 'email', value: 'required, email' },
        { key: 'first_name', value: 'required' },
      ],
    },
  },
  {
    id: 'logic.ifElse',
    type: 'ifElse',
    name: 'If / Else Condition',
    category: 'logic',
    accent: 'violet',
    icon: GitBranch,
    description: 'Branch the workflow down true and false paths.',
    tabs: ['logic'],
    inputs: [{ name: 'data', type: 'object', required: true }],
    outputs: [
      { name: 'true', type: 'branch' },
      { name: 'false', type: 'branch' },
    ],
    fields: [
      f('left', 'Left operand', 'text', { required: true, placeholder: '{{data.email}}' }),
      f('operator', 'Operator', 'select', {
        options: ['equals', 'not equals', 'contains', 'greater than', 'less than', 'is empty', 'is not empty'],
      }),
      f('right', 'Right operand', 'text', { placeholder: 'value' }),
    ],
    defaultConfig: { left: '{{data.email}}', operator: 'is not empty', right: '' },
    branches: ['true', 'false'],
  },
  {
    id: 'logic.filter',
    type: 'filter',
    name: 'Filter',
    category: 'logic',
    accent: 'violet',
    icon: Filter,
    description: 'Only allow items through when a condition matches.',
    tabs: ['logic'],
    inputs: [{ name: 'items', type: 'array' }],
    outputs: [{ name: 'items', type: 'array' }],
    fields: [
      f('field', 'Field', 'text', { required: true, placeholder: 'status' }),
      f('operator', 'Operator', 'select', { options: ['equals', 'not equals', 'contains', 'greater than', 'less than'] }),
      f('value', 'Value', 'text', { placeholder: 'active' }),
    ],
    defaultConfig: { field: 'status', operator: 'equals', value: 'active' },
  },
  {
    id: 'logic.duplicate',
    type: 'duplicateCheck',
    name: 'Duplicate Check',
    category: 'logic',
    accent: 'violet',
    icon: CopyCheck,
    description: 'Detect records that already exist before creating new ones.',
    tabs: ['logic', 'database'],
    inputs: [{ name: 'record', type: 'object', required: true }],
    outputs: [
      { name: 'is_duplicate', type: 'boolean' },
      { name: 'existing_id', type: 'string' },
    ],
    fields: [
      f('matchOn', 'Match on fields', 'text', { required: true, placeholder: 'email' }),
      f('scope', 'Lookup scope', 'select', { options: ['Current collection', 'Connected database', 'Spreadsheet'] }),
    ],
    defaultConfig: { matchOn: 'email', scope: 'Current collection' },
  },
  {
    id: 'logic.contract',
    type: 'dataContract',
    name: 'Data Contract Validation',
    category: 'logic',
    accent: 'violet',
    icon: FileCheck2,
    description: 'Enforce an input/output contract between steps.',
    tabs: ['logic', 'ai'],
    inputs: [{ name: 'data', type: 'object', required: true }],
    outputs: [
      { name: 'data', type: 'object' },
      { name: 'violations', type: 'array' },
    ],
    fields: [
      f('contract', 'Contract fields', 'keyvalue', {
        help: 'field → type (string, number, email, required)',
      }),
      f('onViolation', 'On violation', 'select', { options: ['Warn', 'Block workflow', 'Send to error path'] }),
    ],
    defaultConfig: {
      contract: [
        { key: 'email', value: 'string, required' },
        { key: 'full_name', value: 'string' },
      ],
      onViolation: 'Warn',
    },
  },

  /* ------------------------------- ACTIONS ------------------------------- */
  {
    id: 'action.sheets',
    type: 'addToSheets',
    name: 'Add to Google Sheets',
    category: 'action',
    accent: 'green',
    icon: Table2,
    description: 'Append or update a row in a connected spreadsheet.',
    tabs: ['apps', 'productivity', 'action'],
    requiresCredentials: 'google',
    inputs: [{ name: 'data', type: 'object', required: true }],
    outputs: [{ name: 'row_number', type: 'number' }],
    fields: [
      f('spreadsheet', 'Spreadsheet', 'text', { required: true, placeholder: 'Leads 2026' }),
      f('worksheet', 'Worksheet', 'text', { placeholder: 'Sheet1' }),
      f('mode', 'Mode', 'select', { options: ['Append row', 'Update row', 'Upsert by key'] }),
    ],
    defaultConfig: { spreadsheet: '', worksheet: 'Sheet1', mode: 'Append row' },
  },
  {
    id: 'action.sendEmail',
    type: 'sendEmail',
    name: 'Send Email',
    category: 'action',
    accent: 'green',
    icon: Mail,
    description: 'Send a transactional email through Gmail or SMTP.',
    tabs: ['apps', 'productivity', 'action'],
    requiresCredentials: 'google',
    inputs: [{ name: 'data', type: 'object', required: true }],
    outputs: [{ name: 'message_id', type: 'string' }],
    fields: [
      f('to', 'To', 'text', { required: true, placeholder: '{{data.email}}' }),
      f('subject', 'Subject', 'text', { required: true, placeholder: 'Thanks for reaching out' }),
      f('body', 'Body', 'textarea', { placeholder: 'Hi {{data.first_name}}, …' }),
    ],
    defaultConfig: { to: '{{data.email}}', subject: 'Thanks for reaching out', body: 'Hi {{data.first_name}},\n\nThanks for getting in touch!' },
  },
  {
    id: 'action.notify',
    type: 'sendNotification',
    name: 'Send Notification',
    category: 'action',
    accent: 'green',
    icon: Bell,
    description: 'Post a message to Slack or another notification channel.',
    tabs: ['apps', 'productivity', 'action'],
    requiresCredentials: 'slack',
    inputs: [{ name: 'data', type: 'object', required: true }],
    outputs: [{ name: 'delivered', type: 'boolean' }],
    fields: [
      f('channel', 'Channel', 'text', { required: true, placeholder: '#leads' }),
      f('message', 'Message', 'textarea', { placeholder: 'New lead: {{data.full_name}}' }),
    ],
    defaultConfig: { channel: '#leads', message: 'New lead: {{data.full_name}} <{{data.email}}>' },
  },
  {
    id: 'action.http',
    type: 'httpRequest',
    name: 'HTTP Request',
    category: 'action',
    accent: 'blue',
    icon: Globe,
    description: 'Call any REST API and use the response downstream.',
    tabs: ['apps', 'code', 'action'],
    inputs: [{ name: 'payload', type: 'object' }],
    outputs: [{ name: 'status', type: 'number' }, { name: 'body', type: 'object' }],
    fields: [
      f('method', 'Method', 'select', { options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }),
      f('url', 'URL', 'text', { required: true, placeholder: 'https://api.example.com/v1/leads' }),
      f('headers', 'Headers', 'keyvalue'),
      f('body', 'Body (JSON)', 'textarea', { placeholder: '{\n  "email": "{{data.email}}"\n}' }),
    ],
    defaultConfig: { method: 'POST', url: '', headers: [], body: '{\n  "email": "{{data.email}}"\n}' },
  },
  {
    id: 'action.dbQuery',
    type: 'dbQuery',
    name: 'Database Query',
    category: 'action',
    accent: 'blue',
    icon: Database,
    description: 'Run a query through the backend database service.',
    tabs: ['database', 'action'],
    keywords: ['code', 'sql', 'query', 'script'],
    inputs: [{ name: 'params', type: 'object' }],
    outputs: [{ name: 'rows', type: 'array' }, { name: 'rowCount', type: 'number' }],
    fields: [
      f('connection', 'Connection', 'select', { options: ['Primary (MongoDB)', 'Analytics (read-only)'], required: true }),
      f('operation', 'Operation', 'select', { options: ['find', 'insertOne', 'updateOne', 'aggregate', 'custom'] }),
      f('query', 'Query', 'textarea', { placeholder: '{ "email": "{{data.email}}" }' }),
    ],
    defaultConfig: { connection: 'Primary (MongoDB)', operation: 'find', query: '{ "email": "{{data.email}}" }' },
  },

  /* --------------------------------- CODE -------------------------------- */
  {
    id: 'code.javascript',
    type: 'javascript',
    name: 'JavaScript',
    category: 'code',
    accent: 'blue',
    icon: Braces,
    description: 'Run custom JavaScript in an isolated execution service.',
    tabs: ['code'],
    inputs: [{ name: 'input', type: 'object', required: true }],
    outputs: [{ name: 'output', type: 'object' }],
    language: 'javascript',
    fields: [
      f('code', 'Code', 'code', { language: 'javascript', required: true }),
    ],
    defaultConfig: {
      code: `const data = input.form_data;

const fullName = [
  data.first_name,
  data.last_name
].filter(Boolean).join(" ");

return {
  ...data,
  full_name: fullName
};`,
    },
  },
  {
    id: 'code.python',
    type: 'python',
    name: 'Python',
    category: 'code',
    accent: 'blue',
    icon: Terminal,
    description: 'Run a Python script in an isolated execution service.',
    tabs: ['code'],
    inputs: [{ name: 'input', type: 'object', required: true }],
    outputs: [{ name: 'output', type: 'object' }],
    language: 'python',
    fields: [f('code', 'Code', 'code', { language: 'python', required: true })],
    defaultConfig: {
      code: `def handler(input):
    data = input["form_data"]
    name = " ".join(
        p for p in [data.get("first_name"), data.get("last_name")] if p
    )
    return {**data, "full_name": name}`,
    },
  },
  {
    id: 'code.opencode',
    type: 'codeByOpenCode',
    name: 'Code by OpenCode',
    category: 'code',
    accent: 'violet',
    icon: Code2,
    description: 'Custom-code node with an assisted development area.',
    tabs: ['code', 'ai'],
    inputs: [{ name: 'input', type: 'object' }],
    outputs: [{ name: 'output', type: 'object' }],
    language: 'javascript',
    fields: [
      f('language', 'Language', 'select', { options: ['JavaScript', 'Python'] }),
      f('code', 'Code', 'code', { language: 'javascript' }),
    ],
    defaultConfig: { language: 'JavaScript', code: `// Code by OpenCode\n// Scoped custom step — describe it, then implement.\nreturn input;` },
  },
  {
    id: 'code.ai',
    type: 'aiCode',
    name: 'AI Code',
    category: 'code',
    accent: 'violet',
    icon: Sparkles,
    description: 'Generate or modify code through the AI service.',
    tabs: ['code', 'ai'],
    isAI: true,
    inputs: [{ name: 'input', type: 'object' }],
    outputs: [{ name: 'output', type: 'object' }],
    language: 'javascript',
    fields: [
      f('instruction', 'Instruction', 'textarea', {
        required: true,
        placeholder: 'Normalize the phone number to E.164 and strip whitespace from names.',
      }),
      f('language', 'Language', 'select', { options: ['JavaScript', 'Python'] }),
      f('preview', 'Generated preview', 'code', { language: 'javascript', readOnly: true }),
    ],
    defaultConfig: {
      instruction: 'Normalize the email to lowercase and build a full_name field.',
      language: 'JavaScript',
      preview: `// AI-generated (requires connected AI service)\nreturn {\n  ...input,\n  email: (input.email || "").toLowerCase()\n};`,
    },
  },

  /* --------------------------- DATA TRANSFORMATION ----------------------- */
  {
    id: 'transform.map',
    type: 'mapFields',
    name: 'Map Fields',
    category: 'transform',
    accent: 'violet',
    icon: Shuffle,
    description: 'Rename and remap fields between steps.',
    tabs: ['logic', 'transform'],
    inputs: [{ name: 'data', type: 'object', required: true }],
    outputs: [{ name: 'data', type: 'object' }],
    fields: [f('mappings', 'Mappings', 'keyvalue', { help: 'source field → target field' })],
    defaultConfig: {
      mappings: [
        { key: 'email_address', value: 'email' },
        { key: 'first_name', value: 'first_name' },
      ],
    },
  },
  {
    id: 'transform.transform',
    type: 'transformData',
    name: 'Transform Data',
    category: 'transform',
    accent: 'violet',
    icon: Wand2,
    description: 'Apply expressions to reshape the payload.',
    tabs: ['logic', 'transform', 'code'],
    inputs: [{ name: 'data', type: 'object', required: true }],
    outputs: [{ name: 'data', type: 'object' }],
    fields: [f('expression', 'Expression', 'textarea', { placeholder: '{\n  "full_name": "{{first_name}} {{last_name}}"\n}' })],
    defaultConfig: { expression: '{\n  "full_name": "{{first_name}} {{last_name}}"\n}' },
  },
  {
    id: 'transform.format',
    type: 'formatText',
    name: 'Format Text',
    category: 'transform',
    accent: 'violet',
    icon: Type,
    description: 'Build a string from a template.',
    tabs: ['logic', 'transform'],
    inputs: [{ name: 'data', type: 'object' }],
    outputs: [{ name: 'text', type: 'string' }],
    fields: [f('template', 'Template', 'textarea', { placeholder: 'Hello {{first_name}} {{last_name}}' })],
    defaultConfig: { template: 'Hello {{first_name}} {{last_name}}' },
  },
  {
    id: 'transform.merge',
    type: 'mergeData',
    name: 'Merge Data',
    category: 'transform',
    accent: 'violet',
    icon: GitMerge,
    description: 'Combine outputs from multiple branches.',
    tabs: ['logic', 'transform'],
    inputs: [
      { name: 'a', type: 'object' },
      { name: 'b', type: 'object' },
    ],
    outputs: [{ name: 'data', type: 'object' }],
    fields: [f('strategy', 'Strategy', 'select', { options: ['Shallow merge', 'Deep merge', 'Array concat'] })],
    defaultConfig: { strategy: 'Shallow merge' },
  },

  /* ---------------------------- INTEGRATIONS ------------------------------ *
   * Listed explicitly in the spec as selectable integration cards.           */
  {
    id: 'app.github',
    type: 'github',
    name: 'GitHub',
    category: 'action',
    accent: 'blue',
    icon: Github,
    description: 'Trigger from repository events or run GitHub actions.',
    tabs: ['apps'],
    isIntegration: true,
    requiresCredentials: 'github',
    inputs: [{ name: 'payload', type: 'object' }],
    outputs: [{ name: 'result', type: 'object' }],
    fields: [
      f('repository', 'Repository', 'text', { placeholder: 'owner/repo', required: true }),
      f('event', 'Event', 'select', { options: ['Push', 'Pull request', 'Issue', 'Release'] }),
    ],
    defaultConfig: { repository: '', event: 'Push' },
  },
  {
    id: 'app.gmail',
    type: 'gmail',
    name: 'Gmail',
    category: 'action',
    accent: 'blue',
    icon: Mail,
    description: 'Read, send, or label messages in Gmail.',
    tabs: ['apps', 'productivity'],
    isIntegration: true,
    requiresCredentials: 'google',
    inputs: [{ name: 'data', type: 'object' }],
    outputs: [{ name: 'message_id', type: 'string' }],
    fields: [
      f('action', 'Action', 'select', { options: ['Send email', 'Create draft', 'Add label'] }),
      f('to', 'To', 'text', { placeholder: '{{data.email}}' }),
    ],
    defaultConfig: { action: 'Send email', to: '{{data.email}}' },
  },
  {
    id: 'app.gsheets',
    type: 'googleSheets',
    name: 'Google Sheets',
    category: 'action',
    accent: 'blue',
    icon: Table2,
    description: 'Read and write rows in Google Sheets.',
    tabs: ['apps', 'productivity'],
    isIntegration: true,
    requiresCredentials: 'google',
    inputs: [{ name: 'data', type: 'object' }],
    outputs: [{ name: 'row_number', type: 'number' }],
    fields: [
      f('spreadsheet', 'Spreadsheet', 'text', { required: true }),
      f('operation', 'Operation', 'select', { options: ['Append row', 'Read rows', 'Update row'] }),
    ],
    defaultConfig: { spreadsheet: '', operation: 'Append row' },
  },
  {
    id: 'app.slack',
    type: 'slack',
    name: 'Slack',
    category: 'action',
    accent: 'blue',
    icon: Slack,
    description: 'Send messages and manage Slack channels.',
    tabs: ['apps', 'productivity'],
    isIntegration: true,
    requiresCredentials: 'slack',
    inputs: [{ name: 'data', type: 'object' }],
    outputs: [{ name: 'delivered', type: 'boolean' }],
    fields: [
      f('channel', 'Channel', 'text', { required: true, placeholder: '#general' }),
      f('text', 'Message', 'textarea', { placeholder: 'Workflow update: {{data.full_name}}' }),
    ],
    defaultConfig: { channel: '#general', text: 'Workflow update: {{data.full_name}}' },
  },
  {
    id: 'app.webhook',
    type: 'webhookOut',
    name: 'Webhook',
    category: 'action',
    accent: 'blue',
    icon: Webhook,
    description: 'POST a payload to an external webhook URL.',
    tabs: ['apps'],
    isIntegration: true,
    inputs: [{ name: 'payload', type: 'object' }],
    outputs: [{ name: 'status', type: 'number' }],
    fields: [
      f('url', 'Webhook URL', 'text', { required: true, placeholder: 'https://hooks.example.com/…' }),
      f('method', 'Method', 'select', { options: ['POST', 'PUT'] }),
    ],
    defaultConfig: { url: '', method: 'POST' },
  },
  {
    id: 'app.http',
    type: 'httpRequestApp',
    name: 'HTTP Request',
    category: 'action',
    accent: 'blue',
    icon: Globe,
    description: 'Make authenticated API requests.',
    tabs: ['apps', 'code'],
    isIntegration: true,
    inputs: [{ name: 'payload', type: 'object' }],
    outputs: [{ name: 'status', type: 'number' }, { name: 'body', type: 'object' }],
    fields: [
      f('method', 'Method', 'select', { options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }),
      f('url', 'URL', 'text', { required: true }),
    ],
    defaultConfig: { method: 'GET', url: '' },
  },
  {
    id: 'app.database',
    type: 'database',
    name: 'Database',
    category: 'action',
    accent: 'blue',
    icon: Database,
    description: 'Connect a database through the Synq backend.',
    tabs: ['apps', 'database'],
    isIntegration: true,
    inputs: [{ name: 'params', type: 'object' }],
    outputs: [{ name: 'rows', type: 'array' }],
    fields: [
      f('connection', 'Connection', 'select', { options: ['Primary (MongoDB)', 'Analytics (read-only)'] }),
      f('collection', 'Collection', 'text', { placeholder: 'leads' }),
    ],
    defaultConfig: { connection: 'Primary (MongoDB)', collection: 'leads' },
  },
  {
    id: 'app.schedule',
    type: 'scheduleApp',
    name: 'Schedule',
    category: 'trigger',
    accent: 'blue',
    icon: Clock,
    description: 'Recurring schedule source for a workflow.',
    tabs: ['apps', 'triggers'],
    isIntegration: true,
    inputs: [],
    outputs: [{ name: 'run_at', type: 'string' }],
    fields: [
      f('frequency', 'Frequency', 'select', { options: ['Hourly', 'Daily', 'Weekly'] }),
      f('cron', 'Cron', 'text', { placeholder: '0 * * * *' }),
    ],
    defaultConfig: { frequency: 'Hourly', cron: '0 * * * *' },
  },

  /* --------------------- convenience aliases (Code tab) ------------------- *
   * "Code" generic entry — the spec's code search must surface a plain
   * "Code — Run custom JavaScript or Python" result.                        */
  {
    id: 'code.generic',
    type: 'javascript',
    name: 'Code',
    category: 'code',
    accent: 'blue',
    icon: Layers,
    description: 'Run custom JavaScript or Python in isolation.',
    tabs: ['code', 'ai'],
    aliases: true,
    inputs: [{ name: 'input', type: 'object' }],
    outputs: [{ name: 'output', type: 'object' }],
    language: 'javascript',
    fields: [f('code', 'Code', 'code', { language: 'javascript', required: true })],
    defaultConfig: { code: `// Run custom JavaScript or Python\nreturn input;` },
  },
]

/** Fast lookup by node type. */
export const NODE_BY_TYPE = Object.fromEntries(
  NODE_CATALOG.map((n) => [n.type, n]),
)

/** Fast lookup by catalog id. */
export const NODE_BY_ID = Object.fromEntries(NODE_CATALOG.map((n) => [n.id, n]))

/** Resolve the catalog definition for a React Flow node (falls back sensibly). */
export function getNodeDef(node) {
  if (!node) return null
  // Prefer an explicit catalog id when present (some types share an id).
  if (node.data?.catalogId && NODE_BY_ID[node.data.catalogId]) {
    return NODE_BY_ID[node.data.catalogId]
  }
  return NODE_BY_TYPE[node.type] || null
}

/**
 * Filter the catalog for the Add Node popover.
 * Matches name, description and category; also returns code results for "code".
 * Results are de-duplicated by name so a node that exists as both an action and
 * a named integration (e.g. "HTTP Request") is only offered once — the first,
 * richer catalog entry wins.
 */
export function searchCatalog(query, tab = 'all') {
  const q = (query || '').trim().toLowerCase()
  const seen = new Set()
  const results = []
  for (const node of NODE_CATALOG) {
    const inTab = tab === 'all' || node.tabs?.includes(tab)
    if (!inTab) continue
    if (q) {
      const haystack = [node.name, node.description, node.category, ...(node.tabs || []), ...(node.keywords || [])]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) continue
    }
    const key = (node.name || node.id).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    results.push(node)
  }
  return results
}
