/**
 * Demo dataset
 * ------------
 * Used ONLY by the mock service layer (VITE_USE_MOCK) or when the backend is
 * unreachable. Everything returned from here is clearly labelled "Demo" in the
 * UI — it is never presented as a real backend/AI result.
 */

const now = Date.now()
const mins = (n) => new Date(now - n * 60_000).toISOString()
const hours = (n) => new Date(now - n * 3_600_000).toISOString()
const days = (n) => new Date(now - n * 86_400_000).toISOString()

export const demoProjects = [
  {
    id: 'proj_revenue',
    name: 'Revenue Ops',
    workflows: [
      { id: 'wf_lead_intake', name: 'Lead Intake Automation' },
      { id: 'wf_enrich', name: 'Enrich & Score Leads' },
    ],
  },
  {
    id: 'proj_support',
    name: 'Customer Support',
    workflows: [
      { id: 'wf_triage', name: 'Support Ticket Triage' },
      { id: 'wf_survey', name: 'CSAT Follow-up' },
    ],
  },
]

/** A representative saved workflow graph (React Flow shape). */
export const demoWorkflowGraph = {
  nodes: [
    {
      id: 'n_form',
      type: 'formSubmitted',
      position: { x: 40, y: 160 },
      data: { catalogId: 'trigger.form', label: 'Form Submitted', config: { formId: 'Lead intake', includeMeta: true } },
    },
    {
      id: 'n_validate',
      type: 'validateData',
      position: { x: 340, y: 60 },
      data: {
        catalogId: 'logic.validate',
        label: 'Validate Data',
        config: { rules: [{ key: 'email', value: 'required, email' }, { key: 'first_name', value: 'required' }] },
      },
    },
    {
      id: 'n_dup',
      type: 'duplicateCheck',
      position: { x: 340, y: 290 },
      data: { catalogId: 'logic.duplicate', label: 'Duplicate Check', config: { matchOn: 'email', scope: 'Current collection' } },
    },
    {
      id: 'n_js',
      type: 'javascript',
      position: { x: 660, y: 120 },
      data: {
        catalogId: 'code.javascript',
        label: 'Build full_name',
        config: {
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
    },
    {
      id: 'n_sheets',
      type: 'addToSheets',
      position: { x: 980, y: 40 },
      data: { catalogId: 'action.sheets', label: 'Add to Google Sheets', config: { spreadsheet: 'Leads 2026', worksheet: 'Sheet1', mode: 'Append row' } },
    },
    {
      id: 'n_email',
      type: 'sendEmail',
      position: { x: 980, y: 250 },
      data: { catalogId: 'action.sendEmail', label: 'Send Email', config: { to: '{{data.email}}', subject: 'Thanks for reaching out', body: 'Hi {{data.first_name}},' } },
    },
  ],
  edges: [
    { id: 'e1', source: 'n_form', target: 'n_validate', animated: true },
    { id: 'e2', source: 'n_validate', target: 'n_js' },
    { id: 'e3', source: 'n_form', target: 'n_dup' },
    { id: 'e4', source: 'n_js', target: 'n_sheets' },
    { id: 'e5', source: 'n_js', target: 'n_email' },
  ],
}

export const demoWorkflows = [
  {
    id: 'wf_lead_intake',
    name: 'Lead Intake Automation',
    description: 'Validate, dedupe, enrich and store inbound leads, then notify the sales channel.',
    status: 'active',
    nodes: 6,
    runs: 1284,
    passRate: 96,
    errorRate: 4,
    projectId: 'proj_revenue',
    updatedAt: mins(12),
    createdAt: days(21),
    graph: demoWorkflowGraph,
  },
  {
    id: 'wf_enrich',
    name: 'Enrich & Score Leads',
    description: 'Enrich company data via HTTP and assign a lead score.',
    status: 'active',
    nodes: 9,
    runs: 842,
    passRate: 91,
    errorRate: 9,
    projectId: 'proj_revenue',
    updatedAt: hours(3),
    createdAt: days(18),
  },
  {
    id: 'wf_triage',
    name: 'Support Ticket Triage',
    description: 'Classify tickets, route to the right queue and set priority.',
    status: 'draft',
    nodes: 7,
    runs: 310,
    passRate: 88,
    errorRate: 12,
    projectId: 'proj_support',
    updatedAt: hours(9),
    createdAt: days(12),
  },
  {
    id: 'wf_survey',
    name: 'CSAT Follow-up',
    description: 'Send a satisfaction survey 24h after ticket resolution.',
    status: 'paused',
    nodes: 4,
    runs: 96,
    passRate: 99,
    errorRate: 1,
    projectId: 'proj_support',
    updatedAt: days(2),
    createdAt: days(9),
  },
  {
    id: 'wf_contracts',
    name: 'Vendor Data Contracts',
    description: 'Validate vendor feeds against data contracts and report drift.',
    status: 'active',
    nodes: 11,
    runs: 210,
    passRate: 84,
    errorRate: 16,
    updatedAt: days(1),
    createdAt: days(30),
  },
  {
    id: 'wf_weekly',
    name: 'Weekly Ops Report',
    description: 'Aggregate metrics and post a weekly digest to Slack.',
    status: 'draft',
    nodes: 5,
    runs: 0,
    passRate: 0,
    errorRate: 0,
    updatedAt: days(4),
    createdAt: days(4),
  },
]

/** Deterministic flight-simulator scenarios. */
export const demoScenarios = [
  {
    id: 's_valid',
    name: 'Valid submission',
    expectation: 'pass',
    description: 'A complete, well-formed lead.',
    input: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
  },
  {
    id: 's_missing_email',
    name: 'Missing email',
    expectation: 'fail',
    description: 'No email provided — validation should block the send step.',
    input: { first_name: 'Grace', last_name: 'Hopper', email: '' },
  },
  {
    id: 's_invalid_email',
    name: 'Invalid email format',
    expectation: 'fail',
    description: 'A malformed email address.',
    input: { first_name: 'Alan', last_name: 'Turing', email: 'alan@@invalid' },
  },
  {
    id: 's_duplicate',
    name: 'Duplicate record',
    expectation: 'warn',
    description: 'The email already exists in the destination.',
    input: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', _duplicate: true },
  },
  {
    id: 's_malformed',
    name: 'Malformed data',
    expectation: 'fail',
    description: 'Payload is not the expected object shape.',
    input: 'not-an-object',
  },
  {
    id: 's_missing_field',
    name: 'Missing required field',
    expectation: 'fail',
    description: 'A required field is absent entirely.',
    input: { email: 'katherine@example.com' },
  },
  {
    id: 's_large',
    name: 'Large input',
    expectation: 'pass',
    description: 'A very large payload to check performance limits.',
    input: { first_name: 'X'.repeat(2000), last_name: 'Y'.repeat(2000), email: 'large@example.com' },
  },
  {
    id: 's_renamed',
    name: 'Changed field name',
    expectation: 'warn',
    description: 'Upstream sends email_address instead of email.',
    input: { first_name: 'Margaret', last_name: 'Hamilton', email_address: 'margaret@example.com' },
  },
]

export const demoExecutions = [
  {
    id: 'EXE-7F3A21',
    workflowId: 'wf_lead_intake',
    workflowName: 'Lead Intake Automation',
    trigger: 'Form Submitted',
    status: 'success',
    mode: 'production',
    startedAt: mins(12),
    durationMs: 1840,
    input: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
    logs: [
      { node: 'Form Submitted', status: 'success', ms: 12, output: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' } },
      { node: 'Validate Data', status: 'success', ms: 22, output: { valid: true, errors: [] } },
      { node: 'Build full_name', status: 'success', ms: 34, output: { full_name: 'Ada Lovelace', email: 'ada@example.com' } },
      { node: 'Add to Google Sheets', status: 'success', ms: 620, output: { row_number: 482 } },
      { node: 'Send Email', status: 'success', ms: 890, output: { message_id: 'msg_9f21c', simulated: true } },
    ],
    contractWarnings: [],
  },
  {
    id: 'EXE-7F39D4',
    workflowId: 'wf_lead_intake',
    workflowName: 'Lead Intake Automation',
    trigger: 'Form Submitted',
    status: 'failed',
    mode: 'production',
    startedAt: mins(74),
    durationMs: 640,
    input: { first_name: 'Grace', last_name: 'Hopper', email: '' },
    logs: [
      { node: 'Form Submitted', status: 'success', ms: 9, output: { first_name: 'Grace', last_name: 'Hopper', email: '' } },
      { node: 'Validate Data', status: 'failed', ms: 18, error: 'Required field "email" is empty.', output: { valid: false, errors: ['email required'] } },
      { node: 'Build full_name', status: 'skipped', ms: 0 },
      { node: 'Send Email', status: 'skipped', ms: 0 },
    ],
    contractWarnings: [
      { field: 'email', expected: 'string (required)', actual: 'empty string', severity: 'error', message: 'Downstream email action expects a non-empty "email".' },
    ],
  },
  {
    id: 'SIM-5C81AA',
    workflowId: 'wf_lead_intake',
    workflowName: 'Lead Intake Automation',
    trigger: 'Flight Simulator',
    status: 'warning',
    mode: 'simulation',
    startedAt: hours(2),
    durationMs: 210,
    input: { first_name: 'Margaret', last_name: 'Hamilton', email_address: 'margaret@example.com' },
    logs: [
      { node: 'Form Submitted', status: 'success', ms: 4, output: { first_name: 'Margaret', last_name: 'Hamilton', email_address: 'margaret@example.com' } },
      { node: 'Validate Data', status: 'warning', ms: 8, output: { valid: true, errors: [] } },
      { node: 'Build full_name', status: 'success', ms: 11, output: { full_name: 'Margaret Hamilton', email_address: 'margaret@example.com' } },
      { node: 'Send Email', status: 'warning', ms: 0, output: { skipped: true, reason: 'Missing required field "email"' } },
    ],
    contractWarnings: [
      {
        field: 'email',
        expected: 'email',
        actual: 'email_address',
        severity: 'warning',
        message: 'The "Send Email" step expects "email" but receives "email_address".',
        suggestion: { from: 'email_address', to: 'email' },
      },
    ],
  },
  {
    id: 'SIM-5C80F1',
    workflowId: 'wf_enrich',
    workflowName: 'Enrich & Score Leads',
    trigger: 'Flight Simulator',
    status: 'failed',
    mode: 'simulation',
    startedAt: hours(5),
    durationMs: 1180,
    input: { email: 'alan@example.com' },
    logs: [
      { node: 'Webhook Received', status: 'success', ms: 6, output: { email: 'alan@example.com' } },
      { node: 'HTTP Request', status: 'failed', ms: 1100, error: 'Upstream API returned 429 (rate limited).' },
    ],
    contractWarnings: [],
  },
  {
    id: 'EXE-7F2B10',
    workflowId: 'wf_triage',
    workflowName: 'Support Ticket Triage',
    trigger: 'Webhook Received',
    status: 'success',
    mode: 'production',
    startedAt: hours(8),
    durationMs: 2300,
    input: { subject: 'Cannot reset password', priority: 'high' },
    logs: [
      { node: 'Webhook Received', status: 'success', ms: 8 },
      { node: 'AI Code', status: 'success', ms: 1450, output: { category: 'account', priority: 'high' } },
      { node: 'Send Notification', status: 'success', ms: 780, output: { delivered: true } },
    ],
    contractWarnings: [],
  },
  {
    id: 'EXE-7F1C88',
    workflowId: 'wf_contracts',
    workflowName: 'Vendor Data Contracts',
    trigger: 'Schedule Trigger',
    status: 'warning',
    mode: 'production',
    startedAt: days(1),
    durationMs: 4200,
    input: { vendor: 'Acme Supply', rows: 1200 },
    logs: [
      { node: 'Schedule Trigger', status: 'success', ms: 5 },
      { node: 'Data Contract Validation', status: 'warning', ms: 830, output: { violations: 37 } },
      { node: 'Database Query', status: 'success', ms: 2900, output: { rowCount: 1163 } },
    ],
    contractWarnings: [
      { field: 'sku', expected: 'string', actual: 'number', severity: 'warning', message: '37 rows send "sku" as a number.' },
    ],
  },
]

export const demoContractIssues = [
  {
    id: 'ci_email',
    nodeId: 'n_sheets',
    step: 'Send Email',
    severity: 'warning',
    expected: { name: 'email', type: 'string', required: true },
    actual: { name: 'email_address', type: 'string', required: false },
    message:
      'Downstream step "Send Email" expects a field named "email", but the incoming data provides "email_address".',
    suggestion: { from: 'email_address', to: 'email' },
  },
  {
    id: 'ci_url',
    nodeId: 'n_js',
    step: 'HTTP Request',
    severity: 'error',
    expected: { name: 'url', type: 'string', required: true },
    actual: { name: 'endpoint', type: 'string', required: false },
    message:
      'HTTP Request requires "url" but received "endpoint". The request will fail at runtime.',
    suggestion: { from: 'endpoint', to: 'url' },
  },
  {
    id: 'ci_score',
    nodeId: 'n_validate',
    step: 'Filter',
    severity: 'warning',
    expected: { name: 'score', type: 'number', required: false },
    actual: { name: 'score', type: 'string', required: false },
    message: 'Type mismatch: "score" is expected to be a number but arrives as a string.',
    suggestion: { from: 'score', to: 'score', cast: 'number' },
  },
]

export const demoActivity = [
  { id: 'a1', type: 'execution', title: 'Lead Intake Automation ran successfully', meta: 'EXE-7F3A21 · 1.8s', at: mins(12) },
  { id: 'a2', type: 'warning', title: 'Data-contract warning in Lead Intake Automation', meta: 'email_address → email', at: hours(2) },
  { id: 'a3', type: 'failure', title: 'Enrich & Score Leads failed', meta: 'HTTP 429 rate limited', at: hours(5) },
  { id: 'a4', type: 'publish', title: 'Vendor Data Contracts published', meta: 'by you', at: days(1) },
  { id: 'a5', type: 'execution', title: 'Support Ticket Triage ran successfully', meta: 'EXE-7F2B10 · 2.3s', at: hours(8) },
]

export const demoStats = {
  totalWorkflows: demoWorkflows.length,
  activeWorkflows: demoWorkflows.filter((w) => w.status === 'active').length,
  simulationPassRate: 87,
  failedExecutions: 3,
  contractWarnings: 4,
}

/** Suggested assistant starter prompts (also shown in the panel). */
export const starterPrompts = [
  'Create a workflow from a form submission.',
  'Add email validation before sending.',
  'Explain why this workflow failed.',
  'Generate test scenarios for this workflow.',
  'Find incompatible fields between workflow steps.',
  'Add a JavaScript code step to transform the data.',
]

/**
 * Deterministic demo replies for the assistant. Each entry is matched by
 * keyword. The UI labels these as demo responses.
 */
export const assistantDemoReplies = [
  {
    match: ['create a workflow', 'workflow from a form', 'form submission'],
    reply: `Here is a starter workflow for a form submission. I'd build it in this order so validation happens before anything is written or sent:

1. **Form Submitted** — trigger
2. **Validate Data** — require \`email\` + \`first_name\`
3. **Duplicate Check** — match on \`email\`
4. **JavaScript** — normalise the payload
5. **Add to Google Sheets**
6. **Send Email**

\`\`\`javascript
// Normalise the incoming form payload
const data = input.form_data;

return {
  ...data,
  email: (data.email || "").trim().toLowerCase(),
  full_name: [data.first_name, data.last_name]
    .filter(Boolean)
    .join(" ")
};
\`\`\`

Review this before applying it — I can add these nodes to the canvas one at a time if you prefer.`,
  },
  {
    match: ['email validation', 'validate email', 'before sending'],
    reply: `Add a **Validate Data** step directly after your trigger and before any send action.

Recommended rules:

\`\`\`text
email       → required, email
first_name  → required
\`\`\`

This guarantees the downstream **Send Email** step always receives a real address. I'd also keep the **Duplicate Check** separate so it can branch without blocking valid records.

_This is a demo response. Connect an AI service to get analysis tailored to your live workflow._`,
  },
  {
    match: ['why this workflow failed', 'explain why', 'workflow failed', 'failed'],
    reply: `Looking at the last failure (EXE-7F39D4):

- **Failing step:** \`Validate Data\`
- **Reason:** the required field \`email\` arrived as an empty string.
- **Impact:** the \`Send Email\` step was skipped rather than erroring, so the run is marked failed at validation.

Suggested fixes:
1. Mark \`email\` as **required** on the form so an empty value can't be submitted.
2. Add an error branch on **Validate Data** that notifies an owner instead of silently skipping.
3. Consider normalising with \`.trim()\` before validation, so whitespace-only values are also caught.

_This is a demo response based on the sample execution log._`,
  },
  {
    match: ['test scenarios', 'generate test', 'simulation scenarios'],
    reply: `I generated 8 flight-simulator scenarios for this workflow:

- **Valid submission** → pass
- **Missing email** → fail
- **Invalid email format** → fail
- **Duplicate record** → warn
- **Malformed data** → fail
- **Missing required field** → fail
- **Large input** → pass
- **Changed field name** → warn

Open the **Flight Simulator** and select any scenario to see a step-by-step trace. I can add custom scenarios too.

_This is a demo response._`,
  },
  {
    match: ['incompatible fields', 'contract', 'fields between'],
    reply: `I found one blocking mismatch:

- **Expected:** \`email\` (string, required) — required by **Send Email**
- **Actual:** \`email_address\` (string, optional) — produced upstream
- **Effect:** the email step will skip at runtime.

Suggested repair: map \`email_address → email\`. Test the mapping before applying it — use **Test Repair**, then **Apply Mapping**. I won't modify the saved workflow until you approve.

_This is a demo response._`,
  },
  {
    match: ['javascript code step', 'code step', 'transform the data', 'add a javascript'],
    reply: `Here's a JavaScript step that cleans and enriches the payload:

\`\`\`javascript
const data = input.form_data;

const fullName = [data.first_name, data.last_name]
  .filter(Boolean)
  .join(" ");

return {
  ...data,
  email: (data.email || "").trim().toLowerCase(),
  full_name: fullName
};
\`\`\`

Use the bottom **+** button → **Code** tab → **JavaScript** to place the node, then paste this in and press **Run Test**. Note: execution requires a configured execution service — otherwise only validation and preview run.

_This is a demo response._`,
  },
]

export function pickDemoReply(prompt = '') {
  const p = prompt.toLowerCase()
  const hit = assistantDemoReplies.find((r) => r.match.some((m) => p.includes(m)))
  if (hit) return hit.reply
  return `I'm running in **demo mode**, so I can't analyse your live workflow yet.

I can still help with a few things:
- Draft a workflow from a description
- Suggest validation rules
- Explain a failing step from the sample logs
- Generate test scenarios
- Recommend data-contract repairs

Connect an AI service on the backend (\`OPENAI_API_KEY\`) and set \`VITE_USE_MOCK=false\` to enable real, context-aware responses. Ask me about **validation**, **contracts**, **code**, or **failures** to see a demo answer.`
}
