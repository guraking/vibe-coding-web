import { useState, useRef, useEffect } from 'react'
import { Send, RotateCcw, Bot, User, AlertCircle, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'
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

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center">
      {[0, 150, 300].map(d => (
        <span
          key={d}
          className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
          style={{ animationDelay: `${d}ms`, animationDuration: '1s' }}
        />
      ))}
    </span>
  )
}

export default function ChatPanel({ messages, onSend, isLoading, hasApiKey, width }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submit = () => {
    const text = input.trim()
    if (!text || isLoading || !hasApiKey) return
    onSend(text)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const onInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px'
  }

  const canSend = !!input.trim() && !isLoading && hasApiKey

  return (
    <div
      className="flex flex-col flex-shrink-0 bg-zinc-950 border-r border-zinc-800"
      style={{ width: width ?? 340, minWidth: 220, maxWidth: '60vw' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-zinc-200">AI Chat</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="새 대화"
          >
            <RotateCcw className="w-3 h-3" />
            <span>새 대화</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col h-full px-3 py-4">
            {/* Welcome */}
            <div className="flex-1 flex flex-col items-center justify-center gap-4 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-zinc-800 flex items-center justify-center">
                <Bot className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-zinc-200">무엇을 만들까요?</p>
                <p className="text-xs text-zinc-500">아이디어를 설명하면 바로 만들어드립니다</p>
              </div>
            </div>
            {/* Suggestion chips */}
            <div className="space-y-1">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => { setInput(s); textareaRef.current?.focus() }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all text-left group"
                >
                  <ChevronRight className="w-3 h-3 text-zinc-600 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5 p-4">
            {messages.map((msg, i) => (
              msg.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="flex items-end gap-2 max-w-[88%]">
                    <div className="px-3.5 py-2.5 rounded-2xl rounded-br-sm bg-blue-600 text-white text-xs leading-relaxed shadow-lg">
                      {msg.content}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 mb-0.5">
                      <User className="w-3 h-3 text-zinc-300" />
                    </div>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    {msg.content ? (
                      <p className="text-xs leading-relaxed text-zinc-300">{msg.content}</p>
                    ) : (
                      <TypingDots />
                    )}
                  </div>
                </div>
              )
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="flex-1 pt-0.5"><TypingDots /></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-3 border-t border-zinc-800">
        {!hasApiKey && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            API 키를 먼저 설정하세요 (우측 상단 버튼)
          </div>
        )}
        <div className={cn(
          'rounded-xl bg-zinc-900 border transition-all overflow-hidden',
          input ? 'border-blue-500/50 ring-1 ring-blue-500/10' : 'border-zinc-800'
        )}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            placeholder={hasApiKey ? '무엇을 만들까요? (Enter로 전송)' : 'API 키를 설정해주세요'}
            disabled={!hasApiKey || isLoading}
            rows={2}
            className="w-full bg-transparent resize-none focus:outline-none disabled:opacity-40 text-sm text-zinc-200 placeholder:text-zinc-600 leading-relaxed px-3.5 pt-3 pb-2"
            style={{ minHeight: 56, maxHeight: 180, caretColor: '#3b82f6' }}
          />
          <div className="flex items-center justify-between px-3 pb-2.5">
            <span className="text-xs text-zinc-700 select-none">Shift+Enter 줄바꿈</span>
            <button
              onClick={submit}
              disabled={!canSend}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-lg transition-all',
                canSend
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              )}
            >
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