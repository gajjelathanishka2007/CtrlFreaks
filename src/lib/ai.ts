import type { NodeType } from '../types/workflow'
import { getAiSettings, hasLiveAi, type AiSettings } from './settings'

export interface AiResult {
  result: any
  model: string
  transport: 'demo' | 'live'
}

export interface BlueprintStep {
  type: NodeType
  name: string
  config?: Record<string, any>
}

export interface WorkflowBlueprint {
  name: string
  description: string
  steps: BlueprintStep[]
  transport: 'demo' | 'live'
}

function asText(payload: any): string {
  if (payload === undefined || payload === null) return ''
  if (typeof payload === 'string') return payload
  try {
    return JSON.stringify(payload)
  } catch {
    return String(payload)
  }
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`
}

const POSITIVE = ['good', 'great', 'love', 'excellent', 'happy', 'awesome', 'perfect', 'thanks', 'thank', 'amazing', 'delighted']
const NEGATIVE = ['bad', 'terrible', 'hate', 'awful', 'angry', 'broken', 'worst', 'refund', 'problem', 'error', 'slow', 'unhappy']

/**
 * Deterministic, offline "AI" used when no live provider key is configured.
 * It is a rule-based stand-in, clearly labelled as a demo, so the platform is
 * fully demonstrable without any credentials.
 */
function demoTransform(instruction: string, payload: any): any {
  const text = asText(payload)
  const lower = instruction.toLowerCase()

  if (lower.includes('sentiment')) {
    const tokens = text.toLowerCase().split(/[^a-z]+/).filter(Boolean)
    let score = 0
    for (const t of tokens) {
      if (POSITIVE.includes(t)) score += 1
      if (NEGATIVE.includes(t)) score -= 1
    }
    const sentiment = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral'
    return { sentiment, score, confidence: Math.min(0.5 + Math.abs(score) * 0.15, 0.98) }
  }

  if (lower.includes('summar')) {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
    return {
      summary: truncate(sentences.slice(0, 2).join(' ') || text, 220),
      wordCount: text.split(/\s+/).filter(Boolean).length,
    }
  }

  if (lower.includes('classif') || lower.includes('categor')) {
    const l = text.toLowerCase()
    const category =
      /(invoice|payment|billing|refund|charge)/.test(l)
        ? 'billing'
        : /(bug|error|crash|broken|issue)/.test(l)
          ? 'technical'
          : /(price|buy|demo|pricing|plan)/.test(l)
            ? 'sales'
            : 'general'
    return { category, confidence: 0.72 }
  }

  if (lower.includes('extract')) {
    return {
      emails: text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [],
      urls: text.match(/https?:\/\/[^\s"']+/g) ?? [],
      numbers: (text.match(/-?\d+(\.\d+)?/g) ?? []).map(Number),
    }
  }

  if (lower.includes('title')) {
    return { title: truncate(text.split(/[.!?\n]/)[0] || text, 70) }
  }

  if (lower.includes('key point') || lower.includes('bullet')) {
    const parts = text.split(/[.\n;]/).map((s) => s.trim()).filter(Boolean)
    return { points: parts.slice(0, 4).map((s) => truncate(s, 90)) }
  }

  return {
    result: truncate(text, 240),
    note: 'Demo AI adapter — connect a live provider in Settings for real model output.',
  }
}

async function liveTransform(
  instruction: string,
  payload: any,
  settings: AiSettings,
): Promise<string> {
  const base = settings.baseUrl.replace(/\/$/, '')
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: instruction || 'You are a helpful data assistant.' },
        { role: 'user', content: asText(payload) },
      ],
    }),
  })
  if (!response.ok) {
    throw new Error(`AI provider returned HTTP ${response.status}.`)
  }
  const data = await response.json()
  return data?.choices?.[0]?.message?.content ?? ''
}

export async function runAiTransform(
  instruction: string,
  payload: any,
  settings: AiSettings = getAiSettings(),
): Promise<AiResult> {
  if (!hasLiveAi(settings)) {
    await new Promise((r) => setTimeout(r, 220)) // simulate a little latency
    return { result: demoTransform(instruction, payload), model: 'ctrl-freaks-demo', transport: 'demo' }
  }
  const content = await liveTransform(instruction, payload, settings)
  let parsed: any = content
  try {
    parsed = JSON.parse(content)
  } catch {
    /* keep as string */
  }
  return { result: parsed, model: settings.model, transport: 'live' }
}

const STEP_DEFAULTS: Record<NodeType, { name: string; config?: Record<string, any> }> = {
  manual_trigger: { name: 'Manual Trigger' },
  webhook_trigger: { name: 'Webhook Trigger' },
  set_value: { name: 'Set Value', config: { fields: [{ key: 'message', value: 'Hello {{input.name}}' }], mergeInput: true } },
  transform: { name: 'Transform Data' },
  validate_input: { name: 'Validate Input' },
  log_output: { name: 'Log Output' },
  condition: { name: 'Condition' },
  switch: { name: 'Switch' },
  http_request: { name: 'HTTP Request' },
  save_result: { name: 'Save Result', config: { key: 'result', value: '{{input}}' } },
  notify: { name: 'Send Notification' },
  ai_transform: { name: 'AI Transform', config: { instruction: 'Summarise the input in one sentence.' } },
}

/** Build a blueprint step for a node type using its default name/config. */
function step(type: NodeType): BlueprintStep {
  const base = STEP_DEFAULTS[type]
  return { type, name: base.name, config: base.config ? { ...base.config } : undefined }
}

/**
 * Demo workflow planner. Reads simple intent keywords from the prompt and
 * assembles a valid, runnable blueprint. Always starts with a Manual Trigger.
 */
export function demoDraftWorkflow(prompt: string): WorkflowBlueprint {
  const p = prompt.toLowerCase()
  const steps: BlueprintStep[] = [step('manual_trigger')]

  if (/(valid|check|verify|required)/.test(p)) steps.push(step('validate_input'))
  if (/(condition|if |branch|when|greater|less|threshold)/.test(p)) steps.push(step('condition'))
  if (/(transform|clean|format|map|normalis|normaliz)/.test(p)) steps.push(step('transform'))
  if (/(set|add field|assign|enrich)/.test(p)) steps.push(step('set_value'))
  if (/(webhook|api|http|fetch|request|call)/.test(p)) steps.push(step('http_request'))
  if (/(ai|summar|sentiment|classif|extract|analys|analyze)/.test(p)) steps.push(step('ai_transform'))
  if (/(save|store|persist|record)/.test(p)) steps.push(step('save_result'))
  if (/(notif|email|slack|alert|notify|message)/.test(p)) steps.push(step('notify'))

  // Always finish with a log so the run is easy to read.
  steps.push(step('log_output'))

  // A workflow with only a trigger is not very useful — add a default data step.
  if (steps.length === 2) steps.splice(1, 0, step('transform'))

  const title = truncate(prompt || 'New workflow', 60)
  return {
    name: title.charAt(0).toUpperCase() + title.slice(1),
    description: `Demo-generated from: "${truncate(prompt, 120)}"`,
    steps,
    transport: 'demo',
  }
}

export function draftWorkflow(prompt: string): WorkflowBlueprint {
  // Only the deterministic planner is wired to the graph builder today; the
  // live provider is used by the AI Transform node.
  return demoDraftWorkflow(prompt)
}
