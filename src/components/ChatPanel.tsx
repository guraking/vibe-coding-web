import { useState, useRef, useEffect } from "react"
import type { Message } from "../services/ai"

interface Props {
  messages: Message[]
  onSend: (prompt: string) => void
  isLoading: boolean
  hasApiKey: boolean
  width?: number
}

const SUGGESTIONS = [
  { icon: "✅", text: "투두 앱 만들어줘" },
  { icon: "🛒", text: "쇼핑몰 랜딩 페이지" },
  { icon: "🌤", text: "날씨 위젯 만들어줘" },
  { icon: "🎵", text: "음악 플레이어 UI" },
  { icon: "📊", text: "대시보드 만들어줘" },
  { icon: "🔐", text: "로그인 화면 만들어줘" },
  { icon: "🧮", text: "계산기 앱" },
  { icon: "👤", text: "포트폴리오 페이지" },
]

function Spinner() {
  return (
    <span className="inline-flex gap-[3px] items-end h-3">
      {[0, 120, 240].map((d) => (
        <span key={d} className="inline-block w-[3px] rounded-sm animate-bounce"
          style={{ height: 10, background: "#4e9aea", animationDelay: `${d}ms`, animationDuration: "0.9s" }} />
      ))}
    </span>
  )
}

export default function ChatPanel({ messages, onSend, isLoading, hasApiKey, width }: Props) {
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const submit = () => {
    const text = input.trim()
    if (!text || isLoading || !hasApiKey) return
    onSend(text)
    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = "auto"
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"
  }

  return (
    <div
      className="flex flex-col flex-shrink-0"
      style={{ width: width ?? 320, minWidth: 200, maxWidth: "60vw", background: "#1e1f22", borderRight: "1px solid #282828" }}
    >
      {/* Tool window title bar — IntelliJ style */}
      <div
        className="flex items-center justify-between px-2 flex-shrink-0"
        style={{ height: 30, background: "#2b2d30", borderBottom: "1px solid #282828" }}
      >
        <div className="flex items-center gap-0">
          {/* Tool window tab — active style */}
          <div
            className="flex items-center gap-1.5 px-3 h-full text-xs font-medium"
            style={{
              color: "#bababa",
              borderTop: "2px solid transparent",
              borderBottom: "2px solid #4e9aea",
              height: 30,
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1" fill="#6cace4" opacity="0.9"/>
              <rect x="9" y="1" width="6" height="6" rx="1" fill="#6cace4" opacity="0.6"/>
              <rect x="1" y="9" width="6" height="6" rx="1" fill="#6cace4" opacity="0.6"/>
              <rect x="9" y="9" width="6" height="6" rx="1" fill="#6cace4" opacity="0.3"/>
            </svg>
            <span>AI Chat</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => window.location.reload()}
              className="w-5 h-5 flex items-center justify-center rounded text-xs transition-colors"
              style={{ color: '#606366' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#43454a'; e.currentTarget.style.color = '#bababa' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#606366' }}
              title="초기화"
            >↺</button>
          )}
          <button
            className="w-5 h-5 flex items-center justify-center rounded text-xs transition-colors"
            style={{ color: '#606366' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#43454a'; e.currentTarget.style.color = '#bababa' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#606366' }}
          >⋮</button>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto" style={{ background: "#1e1f22" }}>
        {messages.length === 0 ? (
          <div className="p-3">
            <div
              className="flex items-start gap-2 px-3 py-2.5 mb-3 rounded text-xs"
              style={{ background: "#2b2d30", color: "#606366", border: "1px solid #393b40" }}
            >
              <span style={{ color: "#4e9aea", marginTop: 1 }}>💡</span>
              <span style={{ lineHeight: 1.5 }}>만들고 싶은 것을 선택하거나 직접 입력하세요</span>
            </div>
            <div className="flex flex-col gap-px">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => { setInput(s.text); textareaRef.current?.focus() }}
                  className="flex items-center gap-2.5 text-left text-xs px-2.5 py-1.5 rounded transition-colors"
                  style={{ color: "#9da4ac" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#214283")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{s.icon}</span>
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-2 flex flex-col gap-0.5">
            {messages.map((msg, i) => (
              <div
                key={i}
                className="px-3 py-2 msg-in"
                style={{
                  borderLeft: msg.role === "user" ? "2px solid #4e9aea" : "2px solid transparent",
                  background: msg.role === "user" ? "rgba(78,154,234,0.06)" : "transparent",
                  marginLeft: 0,
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {msg.role === "user" ? (
                    <>
                      <span style={{ color: "#4e9aea", fontSize: 10 }}>▶</span>
                      <span className="text-xs font-semibold" style={{ color: "#4e9aea" }}>나</span>
                    </>
                  ) : (
                    <>
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="7" stroke="#499c54" strokeWidth="1.5"/>
                        <path d="M5 8l2 2 4-4" stroke="#499c54" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-xs font-semibold" style={{ color: "#499c54" }}>AI</span>
                    </>
                  )}
                </div>
                {msg.content ? (
                  <p className="text-xs leading-relaxed pl-4" style={{ color: "#9da4ac" }}>{msg.content}</p>
                ) : (
                  <div className="pl-4 py-1"><Spinner /></div>
                )}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="px-3 py-2" style={{ borderLeft: "2px solid transparent" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="#499c54" strokeWidth="1.5"/>
                    <path d="M5 8l2 2 4-4" stroke="#499c54" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-xs font-semibold" style={{ color: "#499c54" }}>AI</span>
                </div>
                <div className="pl-4"><Spinner /></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 p-2" style={{ borderTop: "1px solid #282828", background: "#1e1f22" }}>
        {!hasApiKey && (
          <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded text-xs"
            style={{ background: "rgba(255,107,104,0.08)", color: "#ff6b68", border: "1px solid rgba(255,107,104,0.25)" }}>
            <span>⚠</span><span>API 키를 먼저 설정하세요</span>
          </div>
        )}
        <div className="flex flex-col rounded" style={{ background: "#2b2d30", border: "1px solid #393b40" }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={onInput}
            onKeyDown={onKeyDown}
            placeholder={hasApiKey ? "만들고 싶은 것을 설명하세요..." : "API 키를 설정해주세요"}
            disabled={!hasApiKey || isLoading}
            rows={3}
            className="bg-transparent resize-none focus:outline-none disabled:opacity-40 leading-relaxed w-full"
            style={{ color: "#bababa", maxHeight: 200, minHeight: 72, caretColor: "#4e9aea", fontSize: 13, padding: "10px 12px" }}
          />
          <div className="flex items-center justify-between px-3 py-1.5" style={{ borderTop: "1px solid #393b40" }}>
            <span className="text-xs select-none" style={{ color: "#4f5255" }}>Enter 전송 · Shift+Enter 줄바꿈</span>
            <button
              onClick={submit}
              disabled={!input.trim() || isLoading || !hasApiKey}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-all disabled:opacity-30"
              style={{ background: "#214283", color: "#6cace4", border: "1px solid #2d5c99" }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "#2d5c99" }}
              onMouseLeave={e => (e.currentTarget.style.background = "#214283")}
            >
              {isLoading ? <Spinner /> : <><span style={{ fontSize: 8 }}>▶</span><span>실행</span></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}