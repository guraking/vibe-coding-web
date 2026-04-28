import { useState, useRef, useEffect } from 'react'
import type { Message } from '../services/ai'

interface Props {
  messages: Message[]
  onSend: (prompt: string) => void
  isLoading: boolean
  hasApiKey: boolean
}

const SUGGESTIONS = [
  '투두 앱 만들어줘',
  '쇼핑몰 랜딩 페이지 만들어줘',
  '날씨 위젯 만들어줘',
  '음악 플레이어 UI',
  '대시보드 만들어줘',
  '로그인 화면 만들어줘',
  '계산기 앱',
  '포트폴리오 페이지',
]

function ThreeDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  )
}

export default function ChatPanel({ messages, onSend, isLoading, hasApiKey }: Props) {
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  return (
    <div className="flex flex-col w-[380px] min-w-[300px] border-r border-gray-800 bg-gray-950">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-5 py-6">
            <div className="text-5xl">⚡</div>
            <div>
              <p className="text-white font-bold text-base mb-1">무엇을 만들까요?</p>
              <p className="text-gray-500 text-sm">아이디어를 입력하면 즉시 만들어드립니다</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s)
                    textareaRef.current?.focus()
                  }}
                  className="px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-300 text-xs rounded-full transition-colors border border-gray-700 hover:border-gray-600"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-xs flex-shrink-0">
                    ⚡
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-violet-600 text-white rounded-br-sm'
                      : 'bg-gray-800 text-gray-200 rounded-bl-sm'
                  }`}
                >
                  {msg.content ? (
                    msg.content
                  ) : (
                    <span className="text-gray-500">
                      <ThreeDots /> 생성 중...
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator when waiting for first stream chunk */}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex items-end gap-2 justify-start">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-xs flex-shrink-0">
                  ⚡
                </div>
                <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
                  <ThreeDots />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="p-3 border-t border-gray-800 flex-shrink-0">
        {!hasApiKey && (
          <div className="mb-2 px-3 py-2 bg-red-900/20 border border-red-800/40 rounded-xl text-red-400 text-xs text-center">
            상단의 ⚠️ 버튼을 눌러 API 키를 먼저 설정해주세요
          </div>
        )}
        <div className="flex items-end gap-2 bg-gray-800/80 border border-gray-700 rounded-2xl px-3 py-2 focus-within:border-violet-500 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={onInput}
            onKeyDown={onKeyDown}
            placeholder={
              hasApiKey
                ? '만들고 싶은 것을 설명하세요... (Enter 전송)'
                : 'API 키를 먼저 설정해주세요'
            }
            disabled={!hasApiKey || isLoading}
            rows={1}
            className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm resize-none focus:outline-none min-h-[24px] max-h-[160px] disabled:opacity-40 leading-relaxed"
          />
          <button
            onClick={submit}
            disabled={!input.trim() || isLoading || !hasApiKey}
            className="flex-shrink-0 w-8 h-8 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:opacity-40 rounded-xl flex items-center justify-center transition-all active:scale-95"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-gray-600 text-xs mt-1.5 text-center">Shift+Enter 줄바꿈</p>
      </div>
    </div>
  )
}
