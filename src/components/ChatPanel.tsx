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
        <span
          key={d}
          className="inline-block w-[3px] rounded-sm animate-bounce"
          style={{ height: 10, background: "#4e9aea", animationDelay: `${d}ms`, animationDuration: "0.9s" }}
        />
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
      style={{ width: width ?? 340, minWidth: 200, maxWidth: "60vw", background: "#2b2b2b", borderRight: "1px solid #323232" }}
    >
      <div
        className="flex items-center justify-between px-3 flex-shrink-0"
        style={{ height: 30, background: "#3c3f41", borderBottom: "1px solid #323232" }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: "#4e9aea", fontSize: 13 }}>💬</span>
          <span className="font-semibold text-xs uppercase tracking-wider" style={{ color: "#a9b7c6" }}>AI Chat</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors"
            style={{ color: "#606366" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#4c5052"; e.currentTarget.style.color = "#a9b7c6" }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#606366" }}
          >↺ 초기화</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="p-3">
            <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded text-xs" style={{ background: "#313335", color: "#606366", border: "1px solid #3c3f41" }}>
              <span style={{ color: "#4e9aea" }}>💡</span>
              <span>만들고 싶은 것을 선택하거나 직접 입력하세요</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => { setInput(s.text); textareaRef.current?.focus() }}
                  className="flex items-center gap-3 text-left text-xs px-3 py-2 rounded transition-colors"
                  style={{ color: "#a9b7c6" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#214283")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: 14 }}>{s.icon}</span>
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-2 flex flex-col gap-1">
            {messages.map((msg, i) => (
              <div
                key={i}
                className="mx-3 rounded msg-in"
                style={{
                  background: msg.role === "user" ? "#313335" : "transparent",
                  border: msg.role === "user" ? "1px solid #4a4a4a" : "none",
                  padding: msg.role === "user" ? "8px 10px" : "6px 10px",
                }}
              >
                <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold" style={{ color: msg.role === "user" ? "#4e9aea" : "#499c54" }}>
                  {msg.role === "user" ? (<><span>▶</span><span>나</span></>) : (<><span>✦</span><span>Vibe AI</span></>)}
                </div>
                {msg.content ? (
                  <p className="text-xs leading-relaxed" style={{ color: "#a9b7c6" }}>{msg.content}</p>
                ) : (
                  <div className="py-1"><Spinner /></div>
                )}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="mx-3 px-2.5 py-2 rounded">
                <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold" style={{ color: "#499c54" }}>
                  <span>✦</span><span>Vibe AI</span>
                </div>
                <Spinner />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="flex-shrink-0 p-2" style={{ borderTop: "1px solid #323232" }}>
        {!hasApiKey && (
          <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded text-xs" style={{ background: "rgba(255,107,104,0.1)", color: "#ff6b68", border: "1px solid rgba(255,107,104,0.3)" }}>
            <span>⚠</span><span>API 키를 먼저 설정하세요</span>
          </div>
        )}
        <div className="flex flex-col rounded" style={{ background: "#313335", border: "1px solid #4a4a4a" }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={onInput}
            onKeyDown={onKeyDown}
            placeholder={hasApiKey ? "만들고 싶은 것을 설명하세요..." : "API 키를 설정해주세요"}
            disabled={!hasApiKey || isLoading}
            rows={3}
            className="bg-transparent resize-none focus:outline-none disabled:opacity-40 leading-relaxed w-full"
            style={{ color: "#a9b7c6", maxHeight: 200, minHeight: 72, caretColor: "#4e9aea", fontSize: 13, padding: "10px 12px" }}
          />
          <div className="flex items-center justify-between px-3 py-2" style={{ borderTop: "1px solid #3c3f41" }}>
            <span className="text-xs select-none" style={{ color: "#606366" }}>Enter 전송 · Shift+Enter 줄바꿈</span>
            <button
              onClick={submit}
              disabled={!input.trim() || isLoading || !hasApiKey}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-all disabled:opacity-30"
              style={{ background: "#4e9aea", color: "#fff" }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "#589df6" }}
              onMouseLeave={e => (e.currentTarget.style.background = "#4e9aea")}
            >
              {isLoading ? <Spinner /> : <span>▶ 실행</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}