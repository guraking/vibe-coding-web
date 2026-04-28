import { useState, useRef, useEffect } from 'react'
import { Send, RotateCcw, Bot, User, AlertCircle, ChevronRight, Loader2 } from 'lucide-react'
import type { Message } from '../services/ai'

interface Props {
  messages: Message[]
  onSend: (prompt: string) => void
  isLoading: boolean
  hasApiKey: boolean
  width?: number
}

const SUGGESTIONS = [
  '투두 앱 만들어줘',
  '쇼핑몰 랜딩 페이지',
  '날씨 위젯 만들어줘',
  '음악 플레이어 UI',
  '대시보드 만들어줘',
  '로그인 화면 만들어줘',
  '계산기 앱 만들어줘',
  '포트폴리오 페이지',
]

function Dots() {
  return (
    <span className="inline-flex gap-1 items-center">
      {[0, 150, 300].map(d => (
        <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ background: 'var(--txt-3)', animationDelay: `${d}ms`, animationDuration: '1s' }} />
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
      style={{ width: width ?? 340, minWidth: 220, maxWidth: '60vw', background: 'var(--bg-panel)', borderRight: '1px solid var(--border)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 h-11 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-s)' }}>
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--txt)' }}>AI Chat</span>
        </div>
        {messages.length > 0 && (
          <button onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs transition-colors"
            style={{ color: 'var(--txt-3)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--txt-2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--txt-3)' }}>
            <RotateCcw className="w-3 h-3" /><span>새 대화</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col h-full px-3 py-4">
            <div className="flex-1 flex flex-col items-center justify-center gap-4 pb-4">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)' }}>
                <Bot className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--txt)' }}>무엇을 만들까요?</p>
                <p className="text-xs" style={{ color: 'var(--txt-3)' }}>아이디어를 설명하면 바로 만들어드립니다</p>
              </div>
            </div>
            <div className="space-y-1">
              {SUGGESTIONS.map(s => (
                <button key={s}
                  onClick={() => { setInput(s); taRef.current?.focus() }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs text-left transition-all group"
                  style={{ color: 'var(--txt-2)', background: 'var(--bg-card)', border: '1px solid var(--border-s)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-bd)'; e.currentTarget.style.color = 'var(--txt)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-s)'; e.currentTarget.style.color = 'var(--txt-2)' }}>
                  <ChevronRight className="w-3 h-3 flex-shrink-0 transition-colors" style={{ color: 'var(--txt-3)' }} />
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {messages.map((msg, i) => (
              msg.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="flex items-end gap-2 max-w-[88%]">
                    <div className="px-3.5 py-2.5 rounded-2xl rounded-br-sm text-xs leading-relaxed"
                      style={{ background: 'var(--accent)', color: 'white' }}>
                      {msg.content}
                    </div>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5"
                      style={{ background: 'var(--bg-hover)' }}>
                      <User className="w-3 h-3" style={{ color: 'var(--txt-2)' }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)' }}>
                    <Bot className="w-3 h-3" style={{ color: 'var(--accent)' }} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    {msg.content
                      ? <p className="text-xs leading-relaxed" style={{ color: 'var(--txt-2)' }}>{msg.content}</p>
                      : <Dots />}
                  </div>
                </div>
              )
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)' }}>
                  <Bot className="w-3 h-3" style={{ color: 'var(--accent)' }} />
                </div>
                <div className="flex-1 pt-1.5"><Dots /></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid var(--border)' }}>
        {!hasApiKey && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg text-xs"
            style={{ background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err)' }}>
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            API 키를 먼저 설정하세요
          </div>
        )}
        <div className="rounded-xl overflow-hidden transition-all"
          style={{
            background: 'var(--bg-card)',
            border: `1px solid ${input ? 'var(--accent-bd)' : 'var(--border)'}`,
            boxShadow: input ? '0 0 0 3px var(--accent-bg)' : 'none',
          }}>
          <textarea ref={taRef} value={input}
            onChange={onInput} onKeyDown={onKey}
            placeholder={hasApiKey ? '무엇을 만들까요? (Enter로 전송)' : 'API 키를 설정해주세요'}
            disabled={!hasApiKey || isLoading} rows={2}
            className="w-full bg-transparent resize-none focus:outline-none disabled:opacity-40 text-sm leading-relaxed"
            style={{ color: 'var(--txt)', minHeight: 56, maxHeight: 180, caretColor: 'var(--accent)', padding: '12px 14px 8px' }}
          />
          <div className="flex items-center justify-between px-3 pb-2.5">
            <span className="text-xs" style={{ color: 'var(--txt-3)' }}>Shift+Enter 줄바꿈</span>
            <button onClick={submit} disabled={!canSend}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
              style={{
                background: canSend ? 'var(--accent)' : 'var(--bg-hover)',
                color: canSend ? 'white' : 'var(--txt-3)',
                boxShadow: canSend ? '0 2px 10px var(--accent-bg)' : 'none',
              }}
              onMouseEnter={e => { if (canSend) e.currentTarget.style.background = 'var(--accent-h)' }}
              onMouseLeave={e => { if (canSend) e.currentTarget.style.background = 'var(--accent)' }}>
              {isLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}