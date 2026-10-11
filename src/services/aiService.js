import { request, delay } from './api.js'
import { pickDemoReply } from '../data/mock.js'

/**
 * AI service.
 * Backend routes (server/routes/ai.js):
 *   GET  /ai/status
 *   POST /ai/chat
 *   POST /ai/generate-code
 *   POST /ai/improvements
 *
 * AI keys live ONLY on the backend. When no AI service is configured the mock
 * returns clearly-labelled demo responses.
 */

export async function getAiStatus() {
  return request('/ai/status', {
    fallback: () => ({ configured: false, provider: 'Demo', model: 'synq-demo-v1', demo: true }),
  })
}

export async function sendMessage({ prompt, context = {} } = {}) {
  await delay(420)
  const fallback = () => {
    let reply = pickDemoReply(prompt)
    const bits = []
    if (context.workflowName) bits.push(`workflow “${context.workflowName}”`)
    if (context.nodeName) bits.push(`node “${context.nodeName}”`)
    if (bits.length) {
      reply += `\n\n_Context I can see: ${bits.join(', ')} (demo context — no live model). _`
    }
    return { reply, demo: true }
  }
  return request('/ai/chat', { method: 'post', data: { prompt, context }, fallback })
}

/** Generate code through AI (used by the AI Code node). */
export async function generateCode({ instruction, language = 'JavaScript', context = {} } = {}) {
  await delay(520)
  const fallback = () => ({
    demo: true,
    language,
    code:
      language === 'Python'
        ? `def handler(input):\n    # Demo output for: ${instruction}\n    return {**input, "processed": True}`
        : `// Demo output for: ${instruction}\nreturn {\n  ...input,\n  processed: true\n};`,
  })
  return request('/ai/generate-code', { method: 'post', data: { instruction, language, context }, fallback })
}

/** Improvement suggestions for the workflow (AI improvement features). */
export async function getImprovements({ context = {} } = {}) {
  await delay(360)
  const fallback = () => ({
    demo: true,
    suggestions: [
      {
        id: 'imp_validate',
        title: 'Add email validation before the send step',
        why: 'The last failure was an empty email field reaching Send Email.',
        evidence: 'EXE-7F39D4 failed at Validate Data: required field "email" is empty.',
        action: 'Add a required + email rule to Validate Data.',
        kind: 'validation',
      },
      {
        id: 'imp_map',
        title: 'Map email_address → email',
        why: 'An upstream source sends email_address; Send Email expects email.',
        evidence: 'Contract warning in SIM-5C81AA.',
        action: 'Add a Map Fields step or repair the contract.',
        kind: 'contract',
      },
      {
        id: 'imp_redundant',
        title: 'Possible redundant step',
        why: 'Two consecutive transform steps shape the same fields.',
        evidence: 'Build full_name and Transform Data both write full_name.',
        action: 'Consider merging them.',
        kind: 'optimize',
      },
    ],
  })
  return request('/ai/improvements', { method: 'post', data: { context }, fallback })
}
