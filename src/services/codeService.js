import { request, delay } from './api.js'

/**
 * Code execution service.
 *
 * SECURITY: user-supplied code is NEVER executed in the browser or in an
 * unrestricted backend process. Real execution is delegated to an isolated
 * sandbox service (backend route POST /code/run). Until that service is
 * configured we only perform a lightweight static validation and honestly
 * report that nothing was executed.
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
    return { ok: false, error: 'A JavaScript code step should return a value.', warn: true }
  }
  return { ok: true }
}

export async function runCode({ code, language = 'javascript', input = {} } = {}) {
  await delay(520)
  const validation = staticValidate(code, language)
  if (!validation.ok) {
    return { data: { executed: false, validation, engineUnavailable: false }, demo: true }
  }

  const fallback = () => ({
    executed: false,
    engineUnavailable: true,
    validation,
    input,
    message:
      'No execution service is configured, so the code was validated but NOT executed. Connect an isolated sandbox service (POST /code/run) to run it.',
  })
  return request('/code/run', { method: 'post', data: { code, language, input }, fallback })
}
