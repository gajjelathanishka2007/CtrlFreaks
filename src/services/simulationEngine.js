/**
 * Synq Flight Simulator — deterministic engine.
 *
 * This runs entirely in the browser and is clearly labelled as a DETERMINISTIC
 * SIMULATION. It does not send real emails, write to spreadsheets, or call
 * external APIs. Code nodes are reported as "not executed" because no execution
 * engine is connected — we never claim arbitrary code ran.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const TRIGGER_TYPES = new Set([
  'start', 'formSubmitted', 'webhookReceived', 'newSheetRow', 'scheduleTrigger', 'scheduleApp',
])
const CODE_TYPES = new Set(['javascript', 'python', 'codeByOpenCode', 'aiCode'])
const ACTION_TYPES = new Set([
  'addToSheets', 'sendEmail', 'sendNotification', 'httpRequest', 'dbQuery',
  'github', 'gmail', 'googleSheets', 'slack', 'webhookOut', 'httpRequestApp', 'database',
])

function topoOrder(nodes, edges) {
  const indeg = new Map(nodes.map((n) => [n.id, 0]))
  const adj = new Map(nodes.map((n) => [n.id, []]))
  for (const e of edges) {
    if (!indeg.has(e.source) || !indeg.has(e.target)) continue
    indeg.set(e.target, (indeg.get(e.target) || 0) + 1)
    adj.get(e.source).push({ target: e.target, handle: e.sourceHandle })
  }
  const queue = nodes.filter((n) => (indeg.get(n.id) || 0) === 0).map((n) => n.id)
  // Stable fallback: if no zero-indegree node (cycle), start from triggers.
  if (!queue.length) {
    for (const n of nodes) if (TRIGGER_TYPES.has(n.type)) queue.push(n.id)
  }
  const order = []
  const seen = new Set()
  while (queue.length) {
    const id = queue.shift()
    if (seen.has(id)) continue
    seen.add(id)
    order.push(id)
    for (const { target } of adj.get(id) || []) {
      indeg.set(target, (indeg.get(target) || 0) - 1)
      if ((indeg.get(target) || 0) <= 0) queue.push(target)
    }
  }
  // Append any unreached nodes so nothing silently disappears.
  for (const n of nodes) if (!seen.has(n.id)) order.push(n.id)
  return { order, adj }
}

function parseRuleTokens(value = '') {
  return String(value)
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
}

function clone(v) {
  try {
    return JSON.parse(JSON.stringify(v))
  } catch {
    return v
  }
}

/**
 * Run a single scenario through the workflow graph.
 */
export function simulateScenario(workflow, scenario) {
  const graph = workflow?.graph || { nodes: [], edges: [] }
  const nodes = graph.nodes || []
  const edges = graph.edges || []
  const { order, adj } = topoOrder(nodes, edges)
  const byId = new Map(nodes.map((n) => [n.id, n]))

  const steps = []
  const dataChanges = []
  const actions = []
  const contractWarnings = []
  let failure = null

  // Seed data from the scenario input.
  let data = clone(scenario.input)
  // Unwrap form_data shape for downstream convenience.
  const flat = () =>
    data && typeof data === 'object' && data.form_data && typeof data.form_data === 'object'
      ? { ...data, ...data.form_data }
      : data

  const skipped = new Set()
  let overall = 'pass'
  let elapsed = 0

  for (const id of order) {
    const node = byId.get(id)
    if (!node) continue
    if (skipped.has(id)) {
      steps.push({
        nodeId: id,
        nodeName: node.data?.label || node.type,
        nodeType: node.type,
        status: 'skipped',
        ms: 0,
        note: 'Branch not taken.',
      })
      continue
    }

    const name = node.data?.label || node.type
    const step = { nodeId: id, nodeName: name, nodeType: node.type, status: 'success', ms: 0 }

    if (TRIGGER_TYPES.has(node.type)) {
      step.ms = 6
      step.input = clone(scenario.input)
      step.output = clone(scenario.input)
      elapsed += step.ms
    } else if (node.type === 'validateData') {
      step.ms = 14
      const d = flat()
      const errors = []
      if (!d || typeof d !== 'object') {
        errors.push('Payload is not an object')
      } else {
        const rules = node.data?.config?.rules || []
        for (const r of rules) {
          const toks = parseRuleTokens(r.value)
          const v = d[r.key]
          const empty = v === undefined || v === null || v === ''
          if (toks.includes('required') && empty) errors.push(`Required field "${r.key}" is empty.`)
          if (!empty && toks.includes('email') && !EMAIL_RE.test(String(v)))
            errors.push(`Field "${r.key}" is not a valid email.`)
          const minTok = toks.find((t) => t.startsWith('min:'))
          if (!empty && minTok && String(v).length < Number(minTok.split(':')[1]))
            errors.push(`Field "${r.key}" is shorter than ${minTok.split(':')[1]}.`)
        }
      }
      step.input = clone(d)
      step.output = { valid: errors.length === 0, errors }
      elapsed += step.ms
      if (errors.length) {
        step.status = 'failed'
        step.error = errors[0]
        overall = overall === 'pass' ? 'fail' : overall
        if (!failure) failure = { node: name, reason: errors[0], hint: 'Add a required rule or an error branch.' }
      }
    } else if (node.type === 'dataContract') {
      step.ms = 10
      const d = flat()
      const violations = []
      const contract = node.data?.config?.contract || []
      for (const c of contract) {
        const toks = parseRuleTokens(c.value)
        const v = d?.[c.key]
        const empty = v === undefined || v === null || v === ''
        if (toks.includes('required') && empty) violations.push({ field: c.key, issue: 'missing' })
        if (!empty && toks.includes('number') && typeof v !== 'number')
          violations.push({ field: c.key, issue: 'type mismatch (expected number)' })
        if (!empty && toks.includes('string') && typeof v !== 'string')
          violations.push({ field: c.key, issue: 'type mismatch (expected string)' })
        if (!empty && toks.includes('email') && !EMAIL_RE.test(String(v)))
          violations.push({ field: c.key, issue: 'invalid email' })
      }
      step.output = { violations }
      elapsed += step.ms
      if (violations.length) {
        step.status = 'warning'
        overall = overall === 'pass' ? 'warn' : overall
        contractWarnings.push(
          ...violations.map((v) => ({
            field: v.field,
            severity: 'warning',
            message: `Contract violation: "${v.field}" — ${v.issue}.`,
          })),
        )
      }
    } else if (node.type === 'duplicateCheck') {
      step.ms = 22
      const d = flat()
      const isDup = !!(d && (d._duplicate || d.is_duplicate))
      step.output = { is_duplicate: isDup, existing_id: isDup ? 'rec_8f21a' : null }
      elapsed += step.ms
      if (isDup) {
        step.status = 'warning'
        step.note = 'Duplicate detected — record will be skipped, not re-created.'
        overall = overall === 'pass' ? 'warn' : overall
      }
    } else if (node.type === 'ifElse') {
      step.ms = 8
      const d = flat()
      const { left, operator, right } = node.data?.config || {}
      const field = String(left || '').replace(/[{}]/g, '').replace(/^data\./, '')
      const value = d?.[field]
      let result = false
      switch (operator) {
        case 'equals': result = String(value) === String(right); break
        case 'not equals': result = String(value) !== String(right); break
        case 'contains': result = String(value ?? '').includes(String(right)); break
        case 'greater than': result = Number(value) > Number(right); break
        case 'less than': result = Number(value) < Number(right); break
        case 'is empty': result = value === undefined || value === null || value === ''; break
        case 'is not empty': result = !(value === undefined || value === null || value === ''); break
        default: result = Boolean(value)
      }
      step.output = { result }
      elapsed += step.ms
      // Skip the branch that was not taken.
      const off = result ? 'false' : 'true'
      for (const { target, handle } of adj.get(id) || []) {
        if (handle === off) skipped.add(target)
      }
    } else if (node.type === 'filter') {
      step.ms = 9
      step.output = { passed: true }
      elapsed += step.ms
    } else if (node.type === 'mapFields') {
      step.ms = 11
      const d = flat()
      const mappings = node.data?.config?.mappings || []
      const next = { ...d }
      for (const m of mappings) {
        if (next[m.key] !== undefined && m.value) {
          if (next[m.value] === undefined) {
            next[m.value] = next[m.key]
            dataChanges.push({ field: m.value, from: undefined, to: next[m.key], via: `mapped from ${m.key}` })
          }
        }
      }
      data = next
      step.input = clone(d)
      step.output = clone(next)
      elapsed += step.ms
    } else if (node.type === 'transformData') {
      step.ms = 12
      const d = flat()
      const next = { ...d }
      const tpl = node.data?.config?.expression || ''
      const fnMatch = tpl.match(/"full_name"\s*:\s*"\{\{first_name\}\}\s*\{\{last_name\}\}"/)
      if (fnMatch) {
        const full = [d.first_name, d.last_name].filter(Boolean).join(' ')
        if (full) {
          next.full_name = full
          dataChanges.push({ field: 'full_name', from: undefined, to: full })
        }
      }
      data = next
      step.output = clone(next)
      elapsed += step.ms
    } else if (node.type === 'formatText') {
      step.ms = 8
      const d = flat()
      const text = String(node.data?.config?.template || '').replace(/\{\{(\w+)\}\}/g, (_, k) => d?.[k] ?? '')
      step.output = { text }
      elapsed += step.ms
    } else if (node.type === 'mergeData') {
      step.ms = 10
      step.output = { merged: true }
      elapsed += step.ms
    } else if (CODE_TYPES.has(node.type)) {
      // Never claim code ran — no engine is connected.
      step.status = 'skipped'
      step.note = 'Not executed — connect an execution service to run code. Simulation continues with pass-through data.'
      elapsed += 12
    } else if (node.type === 'sendEmail' || node.type === 'gmail') {
      step.ms = 40
      const d = flat()
      const to = d?.email
      if (to === undefined || to === null || to === '') {
        step.status = 'warning'
        step.output = { skipped: true, reason: 'Missing required field "email"' }
        step.note = 'Simulated — no email was sent.'
        overall = overall === 'pass' ? 'warn' : overall
        contractWarnings.push({
          field: 'email',
          severity: 'warning',
          message: 'The "Send Email" step expects "email" but the data does not provide it.',
          suggestion: d?.email_address ? { from: 'email_address', to: 'email' } : null,
        })
      } else if (!EMAIL_RE.test(String(to))) {
        step.status = 'failed'
        step.error = `Invalid recipient address "${to}".`
        overall = 'fail'
        if (!failure) failure = { node: name, reason: step.error, hint: 'Validate the email format before sending.' }
      } else {
        step.output = { message_id: 'sim_msg_0001', to }
        step.note = 'Simulated send — no real email delivered.'
        actions.push({ type: 'email', target: to, detail: `Would email "${to}"`, simulated: true })
      }
      elapsed += step.ms
    } else if (node.type === 'sendNotification' || node.type === 'slack') {
      step.ms = 30
      const d = flat()
      step.output = { delivered: true }
      step.note = 'Simulated notification — no real message posted.'
      actions.push({
        type: 'notification',
        target: node.data?.config?.channel || '#leads',
        detail: `Would post to ${node.data?.config?.channel || '#leads'}`,
        simulated: true,
      })
      elapsed += step.ms
    } else if (node.type === 'addToSheets' || node.type === 'googleSheets') {
      step.ms = 55
      const d = flat()
      if (typeof d !== 'object' || d === null) {
        step.status = 'failed'
        step.error = 'Cannot append a non-object payload to a spreadsheet.'
        overall = 'fail'
        if (!failure) failure = { node: name, reason: step.error, hint: 'Ensure upstream steps return an object.' }
      } else {
        step.output = { row_number: 483, simulated: true }
        step.note = 'Simulated append — no real row written.'
        actions.push({ type: 'sheets', target: node.data?.config?.spreadsheet || 'Spreadsheet', detail: 'Would append 1 row', simulated: true })
      }
      elapsed += step.ms
    } else if (node.type === 'httpRequest' || node.type === 'httpRequestApp' || node.type === 'webhookOut') {
      step.ms = 80
      const url = node.data?.config?.url
      if (!url) {
        step.status = 'warning'
        step.output = { skipped: true, reason: 'No URL configured' }
        step.note = 'Simulated — request skipped (no URL).'
        overall = overall === 'pass' ? 'warn' : overall
      } else {
        step.output = { status: 200, body: { ok: true, simulated: true } }
        step.note = 'Simulated HTTP call — no real request made.'
      }
      elapsed += step.ms
    } else if (node.type === 'dbQuery' || node.type === 'database') {
      step.ms = 60
      step.output = { rows: [], rowCount: 0, simulated: true }
      step.note = 'Simulated query — database not contacted.'
      elapsed += step.ms
    } else if (node.type === 'github') {
      step.ms = 45
      step.output = { result: { ok: true, simulated: true } }
      step.note = 'Simulated GitHub action — integration not connected.'
      elapsed += step.ms
    } else {
      step.ms = 8
      elapsed += step.ms
    }

    steps.push(step)
  }

  // Overall status resolved.
  return {
    scenarioId: scenario.id,
    name: scenario.name,
    expectation: scenario.expectation,
    description: scenario.description,
    status: overall,
    asExpected: overall === scenario.expectation,
    durationMs: Math.max(elapsed, 1),
    steps,
    dataChanges,
    actions,
    failure,
    contractWarnings,
  }
}

/** Run a set of scenarios and produce a summary. */
export function simulateWorkflow(workflow, scenarios) {
  const results = scenarios.map((s) => simulateScenario(workflow, s))
  const passed = results.filter((r) => r.status === 'pass').length
  const warned = results.filter((r) => r.status === 'warn').length
  const failed = results.filter((r) => r.status === 'fail').length
  const asExpected = results.filter((r) => r.asExpected).length
  return {
    results,
    summary: {
      total: results.length,
      passed,
      warned,
      failed,
      asExpected,
      unexpected: results.length - asExpected,
      passRate: results.length ? Math.round((passed / results.length) * 100) : 0,
    },
  }
}
