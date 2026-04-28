import { useState, useRef, useEffect } from 'react'
import { Send, RotateCcw, AlertCircle, Loader2, Terminal } from 'lucide-react'
import type { Message } from '../services/ai'

interface Props {
  messages: Message[]
  onSend: (prompt: string) => void
  isLoading: boolean
  hasApiKey: boolean
  width?: number
}

const SUGGESTIONS = [
  { label: 'todo-app', desc: '투두 앱 만들어줘' },
  { label: 'shop-landing', desc: '쇼핑몰 랜딩 페이지' },
  { label: 'weather-widget', desc: '날씨 위젯 만들어줘' },
  { label: 'music-player', desc: '음악 플레이어 UI' },
  { label: 'dashboard', desc: '대시보드 만들어줘' },
  { label: 'login-screen', desc: '로그인 화면 만들어줘' },
  { label: 'calculator', desc: '계산기 앱 만들어줘' },
  { label: 'portfolio', desc: '포트폴리오 페이지' },
]

function Dots() {
  return (
    <span className="inline-flex gap-1 items-center">
      {[0, 150, 300].map(d => (
        <span key={d} className="w-1 h-1 animate-bounce"
          style={{ background: 'var(--accent)', animationDelay: `${d}ms`, animationDuration: '1s' }} />
      ))}
    </span>
  )
}

export default function ChatPanel({ messages, onSend, isLoading, hasApiKey, width }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const submit = () => {
    const t = input.trim()
    if (!t || isLoading || !hasApiKey) return
    onSend(t); setInput('')
    if (taRef.current) taRef.current.style.height = 'auto'
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px'
  }

  const canSend = !!input.trim() && !isLoading && hasApiKey

  return (
    <div className="flex flex-col flex-shrink-0"
      style={{
        width: width ?? 340,
        minWidth: 220,
        maxWidth: '60vw',
        background: 'var(--bg-panel)',
      }}>

      {/* Section header */}
      <div className="flex items-center justify-between px-4 flex-shrink-0"
        style={{ height: 36, borderBottom: '1px solid var(--border-s)' }}>
        <div className="flex items-center gap-2">
          <Terminal style={{ width: 12, height: 12, color: 'var(--accent)' }} />
          <span style={{ color: 'var(--txt-2)', fontFamily: 'var(--mono-font)', fontSize: 11 }}>
            agent / chat
          </span>
        </div>
        {messages.length > 0 && (
          <button onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 transition-colors"
            style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--txt-2)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt-3)'; e.currentTarget.style.background = 'none' }}>
            <RotateCcw style={{ width: 10, height: 10 }} />
            <span>new session</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col h-full">
            {/* Empty state */}
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
              <div style={{
                width: 40, height: 40,
                background: 'var(--accent-bg)',
                border: '1px solid var(--accent-bd)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Terminal style={{ width: 18, height: 18, color: 'var(--accent)' }} />
              </div>
              <div className="text-center">
                <p style={{ color: 'var(--txt)', fontFamily: 'var(--mono-font)', fontSize: 11, marginBottom: 4 }}>
                  What do you want to build?
                </p>
                <p style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
                  Describe your idea and AI will code it instantly
                </p>
              </div>
            </div>

            {/* Suggestions */}
            <div className="px-3 pb-3 space-y-1">
              <p style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10, padding: '6px 4px 4px' }}>
                # quick start
              </p>
              {SUGGESTIONS.map(s => (
                <button key={s.label}
                  onClick={() => { setInput(s.desc); taRef.current?.focus() }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left transition-all"
                  style={{
                    color: 'var(--txt-2)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-s)',
                    fontFamily: 'var(--mono-font)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-bd)'; e.currentTarget.style.color = 'var(--txt)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-s)'; e.currentTarget.style.color = 'var(--txt-2)'; e.currentTarget.style.background = 'var(--bg-card)' }}>
                  <span style={{ color: 'var(--accent)', fontSize: 10 }}>&gt;_</span>
                  <span style={{ color: 'var(--ok)', fontSize: 10 }}>{s.label}</span>
                  <span style={{ color: 'var(--txt-3)', fontSize: 10 }}>—</span>
                  <span style={{ fontSize: 10 }}>{s.desc}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col p-3 gap-2">
            {messages.map((msg, i) => (
              msg.role === 'user' ? (
                /* User message — terminal input style */
                <div key={i} className="flex flex-col">
                  <div className="flex items-start gap-2 px-3 py-2.5"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-s)' }}>
                    <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono-font)', fontSize: 10, flexShrink: 0, paddingTop: 1 }}>
                      &gt;
                    </span>
                    <p style={{ color: 'var(--txt)', fontFamily: 'var(--mono-font)', fontSize: 11, lineHeight: 1.6, wordBreak: 'break-word' }}>
                      {msg.content}
                    </p>
                  </div>
                </div>
              ) : (
                /* AI message — log output style */
                <div key={i} className="flex flex-col">
                  <div className="px-3 py-1" style={{ borderLeft: '2px solid var(--accent-bd)' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono-font)', fontSize: 9 }}>AI</span>
                      <span style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 9 }}>
                        {new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {msg.content
                      ? <p style={{ color: 'var(--txt-2)', fontFamily: 'var(--mono-font)', fontSize: 11, lineHeight: 1.65 }}>{msg.content}</p>
                      : <Dots />}
                  </div>
                </div>
              )
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="px-3 py-1" style={{ borderLeft: '2px solid var(--accent-bd)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono-font)', fontSize: 9 }}>AI</span>
                </div>
                <Dots />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid var(--border)' }}>
        {!hasApiKey && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2"
            style={{ background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
            <AlertCircle style={{ width: 12, height: 12, flexShrink: 0 }} />
            API key not configured — click Settings to add
          </div>
        )}
        <div className="overflow-hidden transition-all"
          style={{
            background: 'var(--bg-card)',
            border: `1px solid ${input ? 'var(--accent-bd)' : 'var(--border)'}`,
            boxShadow: input ? '0 0 0 2px var(--accent-bg)' : 'none',
          }}>
          {/* Prompt prefix */}
          <div className="flex items-start px-3 pt-2.5" style={{ gap: 6 }}>
            <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono-font)', fontSize: 11, userSelect: 'none', lineHeight: '1.6', paddingTop: 1 }}>&gt;_</span>
            <textarea ref={taRef} value={input}
              onChange={onInput} onKeyDown={onKey}
              placeholder={hasApiKey ? 'describe what you want to build...' : 'configure API key first'}
              disabled={!hasApiKey || isLoading} rows={2}
              className="w-full bg-transparent resize-none focus:outline-none disabled:opacity-40"
              style={{
                color: 'var(--txt)',
                fontFamily: 'var(--mono-font)',
                fontSize: 11,
                lineHeight: 1.6,
                minHeight: 44,
                maxHeight: 180,
                caretColor: 'var(--accent)',
              }}
            />
          </div>
          <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
            <span style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 9 }}>
              Shift+Enter for newline
            </span>
            <button onClick={submit} disabled={!canSend}
              className="flex items-center gap-1.5 px-2.5 py-1 transition-all"
              style={{
                background: canSend ? 'var(--accent)' : 'var(--bg-hover)',
                color: canSend ? 'white' : 'var(--txt-3)',
                border: 'none',
                cursor: canSend ? 'pointer' : 'default',
                fontFamily: 'var(--mono-font)',
                fontSize: 10,
              }}
              onMouseEnter={e => { if (canSend) e.currentTarget.style.background = 'var(--accent-h)' }}
              onMouseLeave={e => { if (canSend) e.currentTarget.style.background = 'var(--accent)' }}>
              {isLoading
                ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
                : <><Send style={{ width: 12, height: 12 }} /><span>run</span></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}