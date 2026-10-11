import { Router } from 'express'
import { ah } from './helpers.js'
import { pickDemoReply } from '../../src/data/mock.js'

const router = Router()

const AI_KEY = process.env.OPENAI_API_KEY
const AI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const isConfigured = () => Boolean(AI_KEY)

/** Call the configured AI provider (server-side only — keys never reach the client). */
async function callProvider(messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_KEY}` },
    body: JSON.stringify({ model: AI_MODEL, messages, temperature: 0.4 }),
  })
  if (!res.ok) throw new Error(`AI provider returned ${res.status}`)
  const json = await res.json()
  return json.choices?.[0]?.message?.content || ''
}

router.get('/status', (_req, res) => {
  res.json({
    configured: isConfigured(),
    provider: isConfigured() ? 'OpenAI' : 'Demo',
    model: isConfigured() ? AI_MODEL : 'synq-demo-v1',
    demo: !isConfigured(),
  })
})

router.post(
  '/chat',
  ah(async (req, res) => {
    const { prompt = '', context = {} } = req.body || {}
    if (!isConfigured()) {
      return res.json({ reply: pickDemoReply(prompt), demo: true })
    }
    const system = `You are the Synq Assistant for a workflow automation platform. Help users design, debug and improve workflows. Current workflow: ${context.workflowName || 'none'}. Selected node: ${context.nodeName || 'none'}. Be concise, use short lists, and include code in fenced blocks.`
    try {
      const reply = await callProvider([
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ])
      res.json({ reply, demo: false })
    } catch (err) {
      res.status(502).json({ error: err.message })
    }
  }),
)

router.post(
  '/generate-code',
  ah(async (req, res) => {
    const { instruction = '', language = 'JavaScript', context = {} } = req.body || {}
    if (!isConfigured()) {
      const code =
        language === 'Python'
          ? `def handler(input):\n    # Demo output for: ${instruction}\n    return {**input}`
          : `// Demo output for: ${instruction}\nreturn { ...input };`
      return res.json({ code, language, demo: true })
    }
    try {
      const code = await callProvider([
        { role: 'system', content: `Return only ${language} code that transforms a variable named "input" and returns the result. No prose.` },
        { role: 'user', content: `${instruction}\nContext: ${context.workflowName || ''}` },
      ])
      res.json({ code: stripFences(code), language, demo: false })
    } catch (err) {
      res.status(502).json({ error: err.message })
    }
  }),
)

router.post(
  '/improvements',
  ah(async (req, res) => {
    // Demo suggestions unless a provider is configured to analyse the graph.
    res.json({
      demo: !isConfigured(),
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
      ],
    })
  }),
)

function stripFences(s = '') {
  return s.replace(/^```[a-z]*\n?/i, '').replace(/```$/,'').trim()
}

export default router
