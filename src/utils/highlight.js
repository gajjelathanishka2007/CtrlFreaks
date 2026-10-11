/**
 * Lightweight, dependency-free syntax highlighter for the code editor and
 * assistant code blocks. Supports JavaScript and Python token sets.
 *
 * NOTE: input is escaped before highlighting; output is safe to inject via
 * dangerouslySetInnerHTML.
 */

const JS_KEYWORDS = [
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'do', 'switch', 'case', 'default', 'break', 'continue', 'new', 'class',
  'extends', 'super', 'this', 'import', 'from', 'export', 'async', 'await',
  'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'delete', 'void',
  'yield', 'static', 'null', 'undefined', 'true', 'false', 'in', 'of',
]

const PY_KEYWORDS = [
  'def', 'return', 'if', 'elif', 'else', 'for', 'while', 'break', 'continue',
  'import', 'from', 'as', 'class', 'try', 'except', 'finally', 'raise', 'with',
  'lambda', 'None', 'True', 'False', 'and', 'or', 'not', 'in', 'is', 'pass',
  'global', 'nonlocal', 'yield', 'async', 'await', 'assert', 'del',
]

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function highlightCode(code, lang = 'javascript') {
  if (code == null) return ''
  const isPy = lang === 'python'
  const keywords = (isPy ? PY_KEYWORDS : JS_KEYWORDS).join('|')

  const comment = isPy ? '#[^\\n]*' : '\\/\\/[^\\n]*'
  const string =
    '"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|`(?:\\\\.|[^`\\\\])*`'
  const number = '\\b\\d+(?:\\.\\d+)?\\b'
  const keyword = `\\b(?:${keywords})\\b`
  const fn = '\\b[A-Za-z_$][\\w$]*(?=\\s*\\()'

  const re = new RegExp(
    `(?<comment>${comment})|(?<string>${string})|(?<number>${number})|(?<keyword>${keyword})|(?<fn>${fn})`,
    'g',
  )

  const safe = escapeHtml(String(code))
  return safe.replace(re, (match, ...args) => {
    const groups = args[args.length - 1] || {}
    const kind =
      (groups.comment && 'comment') ||
      (groups.string && 'string') ||
      (groups.number && 'number') ||
      (groups.keyword && 'keyword') ||
      (groups.fn && 'fn')
    return `<span class="tok-${kind}">${match}</span>`
  })
}

/** Split a fenced code string into { lang, code } segments for chat rendering. */
export function parseCodeFences(text = '') {
  const parts = []
  const re = /```(\w+)?\n?([\s\S]*?)```/g
  let last = 0
  let m
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) })
    parts.push({ type: 'code', lang: (m[1] || 'javascript').toLowerCase(), value: m[2].replace(/\n$/, '') })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}
