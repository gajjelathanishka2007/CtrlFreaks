import { Router } from 'express'
import { ah } from './helpers.js'

const router = Router()

/**
 * Code execution endpoint.
 *
 * SECURITY: arbitrary user code is NEVER executed in this process.
 * When CODE_RUNNER_URL is configured, the request is forwarded to an isolated
 * sandbox service. Otherwise we only perform a lightweight static validation
 * and clearly report that nothing was executed.
 */

function staticValidate(code, language) {
  const trimmed = (code || '').trim()
  if (!trimmed) return { ok: false, error: 'Code is empty.' }
  const pairs = { '(': ')', '[': ']', '{': '}' }
  const stack = []
  let inStr = null
  let inComment = false
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i]
    const next = trimmed[i + 1]
    if (inComment) {
      if (c === '\n') inComment = false
      continue
    }
    if (inStr) {
      if (c === '\\') {
        i++
        continue
      }
      if (c === inStr) inStr = null
      continue
    }
    if (c === '/' && next === '/') {
      inComment = true
      i++
      continue
    }
    if (c === '#') {
      inComment = true
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c
      continue
    }
    if (pairs[c]) stack.push(pairs[c])
    else if (c === ')' || c === ']' || c === '}') {
      if (stack.pop() !== c) return { ok: false, error: `Unexpected "${c}".` }
    }
  }
  if (inStr) return { ok: false, error: 'Unterminated string literal.' }
  if (stack.length) return { ok: false, error: `Unclosed delimiter — expected "${stack.pop()}".` }
  if (language === 'javascript' && !/\breturn\b/.test(trimmed)) {
    return { ok: false, error: 'A JavaScript code step should return a value.' }
  }
  return { ok: true }
}

router.post(
  '/run',
  ah(async (req, res) => {
    const { code, language = 'javascript', input = {} } = req.body || {}
    const validation = staticValidate(code, language)
    if (!validation.ok) {
      return res.json({ executed: false, engineUnavailable: false, validation })
    }

    if (process.env.CODE_RUNNER_URL) {
      try {
        const r = await fetch(process.env.CODE_RUNNER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, language, input }),
        })
        const json = await r.json()
        return res.json({ executed: true, engineUnavailable: false, validation, output: json.output, stderr: json.stderr })
      } catch (err) {
        return res.status(502).json({ error: `Execution service error: ${err.message}` })
      }
    }

    res.json({
      executed: false,
      engineUnavailable: true,
      validation,
      input,
      message:
        'No execution service is configured, so the code was validated but NOT executed. Set CODE_RUNNER_URL to an isolated sandbox.',
    })
  }),
)

export default router
