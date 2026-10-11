import { useEffect, useRef, useState } from 'react'
import { Sparkles, Send, RefreshCw, X, Bot, AlertCircle, Wifi } from 'lucide-react'
import { Badge, Tooltip, Spinner } from '../ui/index.js'
import CodeBlock from './CodeBlock.jsx'
import RichText from './RichText.jsx'
import { sendMessage, getAiStatus } from '../../services/aiService.js'
import { starterPrompts } from '../../data/mock.js'
import { parseCodeFences } from '../../utils/highlight.js'
import { cn } from '../../utils/cn.js'
import { uid } from '../../utils/id.js'

export default function AssistantPanel({ workflowName, nodeName, onClose, pendingPrompt, onConsumePrompt, className }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    getAiStatus().then(({ data }) => setStatus(data))
  }, [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])

  // External prompts (e.g. "Ask AI" in the node panel).
  useEffect(() => {
    if (pendingPrompt) {
      send(pendingPrompt)
      onConsumePrompt?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt])

  const send = async (text) => {
    const prompt = (text ?? input).trim()
    if (!prompt || loading) return
    setInput('')
    setError(null)
    setMessages((m) => [...m, { id: uid('m'), role: 'user', content: prompt }])
    setLoading(true)
    try {
      const { data } = await sendMessage({ prompt, context: { workflowName, nodeName } })
      setMessages((m) => [...m, { id: uid('m'), role: 'assistant', content: data.reply, demo: data.demo }])
    } catch (e) {
      setError(e?.message || 'The assistant could not respond. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const isDemo = !status?.configured

  return (
    <div className={cn('flex h-full flex-col bg-sidebar', className)}>
      {/* Header */}
      <header className="flex items-center gap-2.5 border-b border-edge px-3.5 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet/12 text-violet">
          <Sparkles size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">Synq Assistant</p>
          <p className="truncate text-[10px] text-faint">
            {status ? (isDemo ? 'Demo responses' : `${status.provider} · ${status.model}`) : 'Connecting…'}
          </p>
        </div>
        <Tooltip label="Clear conversation" side="left">
          <button
            onClick={() => setMessages([])}
            aria-label="Clear conversation"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-elevated hover:text-ink"
          >
            <RefreshCw size={15} />
          </button>
        </Tooltip>
        {onClose && (
          <Tooltip label="Close assistant" side="left">
            <button
              onClick={onClose}
              aria-label="Close assistant"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-elevated hover:text-ink"
            >
              <X size={15} />
            </button>
          </Tooltip>
        )}
      </header>

      {/* Demo notice */}
      {status && isDemo && (
        <div className="flex items-center gap-2 border-b border-edge bg-violet/8 px-3.5 py-2 text-[11px] text-violet">
          <Wifi size={12} />
          Demo mode — no live AI model is connected. Responses are illustrative.
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3.5 py-4 synq-scroll">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="flex gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet/12 text-violet">
                <Bot size={15} />
              </span>
              <div className="rounded-xl rounded-tl-sm border border-edge bg-card px-3 py-2.5">
                <RichText
                  text={`Hi! I'm the **Synq Assistant**. I can help you design, debug, and improve workflows.

Context I can see: **${workflowName || 'no workflow selected'}**${nodeName ? ` → node **${nodeName}**` : ''}.`}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 px-0.5 text-[11px] font-medium uppercase tracking-wide text-faint">Suggested prompts</p>
              <div className="flex flex-col gap-1.5">
                {starterPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="rounded-lg border border-edge bg-card px-3 py-2 text-left text-[12px] text-muted transition hover:border-violet/40 hover:bg-violet/8 hover:text-ink"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-neon/12 px-3 py-2 text-[12.5px] text-ink">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet/12 text-violet">
                <Bot size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="rounded-xl rounded-tl-sm border border-edge bg-card px-3 py-2.5">
                  <MessageContent content={m.content} />
                </div>
                {m.demo && (
                  <p className="mt-1 px-0.5 text-[10px] text-violet/80">Demo response · not from a live model</p>
                )}
              </div>
            </div>
          ),
        )}

        {loading && (
          <div className="flex gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet/12 text-violet">
              <Bot size={15} />
            </span>
            <div className="flex items-center gap-2 rounded-xl rounded-tl-sm border border-edge bg-card px-3 py-2.5 text-muted">
              <Spinner size={13} className="text-violet" />
              <span className="text-[12px]">Thinking…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-error/30 bg-error/8 p-3 text-error">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <div className="text-[12px]">
              <p className="font-medium">Something went wrong</p>
              <p className="mt-0.5 text-error/80">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Contextual quick actions */}
      <div className="flex flex-wrap gap-1.5 border-t border-edge px-3.5 py-2">
        {['Explain why this failed', 'Generate test scenarios', 'Find incompatible fields'].map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            className="rounded-full border border-edge px-2.5 py-1 text-[11px] text-muted transition hover:border-violet/40 hover:text-violet"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-edge p-3">
        <div className="flex items-end gap-2 rounded-xl border border-edge bg-card p-2 focus-within:border-violet/50">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Ask about your workflow…"
            aria-label="Message the Synq Assistant"
            className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent px-1 py-1 text-[12.5px] text-ink placeholder:text-faint focus:outline-none synq-scroll"
          />
          <Tooltip label="Send (Enter)" side="left">
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              aria-label="Send message"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </Tooltip>
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-faint">
          Shift + Enter for a new line. Review AI suggestions before applying them.
        </p>
      </div>
    </div>
  )
}

function MessageContent({ content }) {
  const parts = parseCodeFences(content)
  return (
    <div className="space-y-1">
      {parts.map((p, i) =>
        p.type === 'code' ? (
          <CodeBlock key={i} code={p.value} language={p.lang} />
        ) : (
          p.value.trim() && <RichText key={i} text={p.value} />
        ),
      )}
    </div>
  )
}
