'use client'

import { useState, useRef, useEffect } from 'react'

type AgentEvent =
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; tool: string; input: Record<string, unknown> }
  | { type: 'done'; summary: string }
  | { type: 'error'; message: string }

// MCP tool names are prefixed with the server name: bitrefill__<tool-name>
function toolLabel(name: string): string {
  const labels: Record<string, string> = {
    'search-products': '🔍 Searching Bitrefill catalog',
    'get-product-details': '📦 Getting product details',
    'buy-products': '🛒 Placing order',
    'get-invoice-by-id': '⏳ Checking delivery status',
    'list-invoices': '📋 Checking invoice history',
    'submit-prepayment-step': '📝 Processing payment step',
    'update-order': '✅ Updating order',
  }
  // Strip server prefix (e.g. "bitrefill__search-products" → "search-products")
  const key = name.includes('__') ? name.split('__').slice(1).join('__') : name
  return labels[key] ?? name
}

const SUGGESTIONS = [
  'Send a welcome gift to someone in Syldavia',
  'Get a test product bundle from Syldavia',
  'Buy a delos-syldavia gift card for €0.01',
  'Test the order polling with slowcorp-syldavia',
]

export default function Home() {
  const [goal, setGoal] = useState('')
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  async function runAgent() {
    if (!goal.trim() || running) return
    setEvents([])
    setDone(false)
    setRunning(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal }),
        signal: controller.signal,
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event: AgentEvent = JSON.parse(line)
            setEvents(prev => [...prev, event])
            if (event.type === 'done' || event.type === 'error') setDone(true)
          } catch { /* skip malformed lines */ }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setEvents(prev => [...prev, { type: 'error', message: err.message }])
      }
      setDone(true)
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }

  function stopAgent() {
    abortRef.current?.abort()
  }

  const reset = () => {
    setGoal('')
    setEvents([])
    setDone(false)
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12">

      {/* Header */}
      <div className="text-center mb-10">
        <p className="text-xs uppercase tracking-widest text-emerald-500 mb-2">Powered by Bitrefill MCP</p>
        <h1 className="text-4xl font-bold text-white mb-2">Relay</h1>
        <p className="text-gray-400 text-sm max-w-sm mx-auto">
          Describe what you need. The agent searches, picks, buys, and delivers — entirely on its own.
        </p>
      </div>

      {/* Goal input */}
      {!running && !events.length && (
        <div className="w-full max-w-xl">
          <div className="bg-[#111a14] border border-[#1e3326] rounded-2xl p-4">
            <textarea
              className="w-full bg-transparent text-white placeholder-gray-500 resize-none outline-none text-sm leading-relaxed"
              rows={3}
              placeholder="e.g. Send a welcome gift bundle to our new teammate in Syldavia"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runAgent() }
              }}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={runAgent}
                disabled={!goal.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Run agent →
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => setGoal(s)}
                className="text-xs text-gray-400 border border-[#1e3326] hover:border-emerald-700 hover:text-emerald-400 rounded-full px-3 py-1 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Agent stream */}
      {(running || events.length > 0) && (
        <div className="w-full max-w-xl">

          {/* Goal recap */}
          <div className="bg-[#111a14] border border-[#1e3326] rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
            <span className="text-emerald-500 mt-0.5">🎯</span>
            <p className="text-sm text-gray-300">{goal}</p>
          </div>

          {/* Events */}
          <div className="space-y-2">
            {events.map((event, i) => (
              <EventCard key={i} event={event} />
            ))}

            {running && (
              <div className="flex items-center justify-between px-1 py-1">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <span className="animate-pulse">●</span>
                  <span>Agent working...</span>
                </div>
                <button
                  onClick={stopAgent}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-800/40 hover:border-red-600 px-3 py-1 rounded-lg transition-colors"
                >
                  Stop
                </button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {done && (
            <div className="mt-6">
              <button
                onClick={reset}
                className="w-full border border-[#1e3326] hover:border-emerald-700 text-gray-300 hover:text-white text-sm py-2 rounded-lg transition-colors"
              >
                New goal
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  )
}

function EventCard({ event }: { event: AgentEvent }) {
  if (event.type === 'thinking') {
    return (
      <div className="bg-[#0e1711] border border-[#1a2e1f] rounded-xl px-4 py-3">
        <p className="text-sm text-gray-300 leading-relaxed">{event.text}</p>
      </div>
    )
  }

  if (event.type === 'tool_call') {
    const label = toolLabel(event.tool)
    const inputStr = JSON.stringify(event.input)
    return (
      <div className="flex items-center gap-3 px-1 py-1">
        <span className="text-sm text-emerald-400 shrink-0">{label}</span>
        <span className="text-xs text-gray-600 font-mono truncate">{inputStr}</span>
      </div>
    )
  }

  if (event.type === 'done') {
    return <ReceiptCard summary={event.summary} />
  }

  if (event.type === 'error') {
    return (
      <div className="bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3">
        <p className="text-sm text-red-400">{event.message}</p>
      </div>
    )
  }

  return null
}

function ReceiptCard({ summary }: { summary: string }) {
  const [copied, setCopied] = useState<number | null>(null)
  const lines = summary.split('\n')

  function copyText(text: string, idx: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(idx)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-5 py-5 mt-2 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-emerald-400 text-lg">✓</span>
        <span className="text-sm font-semibold text-emerald-300 uppercase tracking-wide">Purchase complete</span>
      </div>

      <div className="space-y-1.5">
        {lines.map((line, i) => {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'PURCHASE COMPLETE') return null

          // "Code: XXXX" → code block with copy button
          const codeMatch = trimmed.match(/^Code:\s*(.+)$/i)
          if (codeMatch) {
            const code = codeMatch[1].trim()
            return (
              <div key={i} className="flex items-center justify-between bg-[#0a1a0e] rounded-lg px-3 py-2 gap-3">
                <p className="text-sm font-mono text-white truncate">{code}</p>
                <button
                  onClick={() => copyText(code, i)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 shrink-0 transition-colors"
                >
                  {copied === i ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )
          }

          // "Link: https://..." → clickable link
          const linkMatch = trimmed.match(/^Link:\s*(https?:\/\/.+)$/i)
          if (linkMatch) {
            return (
              <a
                key={i}
                href={linkMatch[1]}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-emerald-400 hover:text-emerald-300 underline truncate transition-colors"
              >
                {linkMatch[1]}
              </a>
            )
          }

          // Section headers (e.g. "What was bought:")
          if (trimmed.endsWith(':') && !trimmed.startsWith('-')) {
            return (
              <p key={i} className="text-xs text-gray-500 uppercase tracking-wide pt-1">
                {trimmed.slice(0, -1)}
              </p>
            )
          }

          // Everything else
          return (
            <p key={i} className="text-sm text-gray-300 leading-relaxed">{trimmed}</p>
          )
        })}
      </div>
    </div>
  )
}
