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
  { icon: "📋", text: "투두 앱 만들어줘" },
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
      {[0, 80, 160].map((d) => (
        <span key={d} className="inline-block w-[3px] rounded-sm animate-bounce" style={{ height: 10, background: "#007acc", animationDelay: `${d}ms`, animationDuration: "0.8s" }} />
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
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px"
  }

  return (
    <div className="flex flex-col flex-shrink-0" style={{ width: width ?? 340, minWidth: 200, maxWidth: '60vw', borderRight: "1px solid #3c3c3c", background: "#252526" }}>
      <div className="flex items-center justify-between px-3 flex-shrink-0 uppercase tracking-widest text-[10px] font-semibold" style={{ height: 36, color: "#bbb", borderBottom: "1px solid #1e1e1e" }}>
        <span>CHAT</span>
        {messages.length > 0 && (
          <button onClick={() => window.location.reload()} className="text-[10px] normal-case tracking-normal transition-colors" style={{ color: "#858585" }} onMouseEnter={e => (e.currentTarget.style.color = "#cccccc")} onMouseLeave={e => (e.currentTarget.style.color = "#858585")} title="대화 초기화">
            ↺ 초기화
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="p-3">
            <div className="mb-3 px-3 py-2 text-xs font-mono" style={{ color: "#6a9955" }}>
              {"// 만들고 싶은 것을 선택하거나 직접 입력하세요"}
            </div>
            <div className="flex flex-col gap-0.5">
              {SUGGESTIONS.map((s, i) => (
                <button key={s.text} onClick={() => { setInput(s.text); textareaRef.current?.focus() }} className="flex items-center text-left text-xs px-2 py-1.5 transition-colors" style={{ color: "#cccccc" }} onMouseEnter={e => (e.currentTarget.style.background = "#094771")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <span className="select-none mr-4 text-right inline-block" style={{ color: "#858585", minWidth: 24 }}>{i + 1}</span>
                  <span style={{ color: "#c586c0" }}>const </span>
                  <span style={{ color: "#dcdcaa" }}>idea</span>
                  <span style={{ color: "#cccccc" }}>{" = "}</span>
                  <span style={{ color: "#ce9178" }}>{`"${s.text}"`}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-2">
            {messages.map((msg, i) => (
              <div key={i} className="px-3 py-1.5 text-xs leading-relaxed" style={{ borderLeft: msg.role === "user" ? "2px solid #007acc" : "2px solid #4ec9b0", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center gap-1.5 mb-1" style={{ color: msg.role === "user" ? "#007acc" : "#4ec9b0" }}>
                  <span className="font-semibold uppercase tracking-wider text-[10px]">{msg.role === "user" ? "▶ YOU" : "⚡ VIBE AI"}</span>
                </div>
                {msg.content ? (
                  <p style={{ color: "#cccccc", paddingLeft: 12 }}>{msg.content}</p>
                ) : (
                  <span style={{ paddingLeft: 12 }}><Spinner /></span>
                )}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="px-3 py-1.5 text-xs" style={{ borderLeft: "2px solid #4ec9b0" }}>
                <div className="flex items-center gap-1.5 mb-1" style={{ color: "#4ec9b0" }}>
                  <span className="font-semibold uppercase tracking-wider text-[10px]">⚡ VIBE AI</span>
                </div>
                <div style={{ paddingLeft: 12 }}><Spinner /></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="flex-shrink-0" style={{ borderTop: "1px solid #3c3c3c" }}>
        {!hasApiKey && (
          <div className="px-3 py-2 text-xs font-mono" style={{ background: "rgba(244,71,71,0.08)", color: "#f44747", borderBottom: "1px solid #3c3c3c" }}>
            {"⚠ API 키를 먼저 설정하세요 (우상단 버튼)"}
          </div>
        )}
        <div className="flex flex-col gap-0" style={{ background: "#2d2d2d", margin: "8px", borderRadius: 6, border: "1px solid #3c3c3c" }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={onInput}
            onKeyDown={onKeyDown}
            placeholder={hasApiKey ? "만들고 싶은 것을 설명하세요..." : "API 키를 설정해주세요"}
            disabled={!hasApiKey || isLoading}
            rows={3}
            className="bg-transparent resize-none focus:outline-none disabled:opacity-40 leading-relaxed w-full font-mono"
            style={{ color: "#d4d4d4", maxHeight: 200, minHeight: 72, caretColor: "#007acc", fontSize: 13, padding: "10px 12px" }}
          />
          <div className="flex items-center justify-between px-3 pb-2">
            <span className="text-[10px] select-none" style={{ color: "#555" }}>Enter 전송 · Shift+Enter 줄바꿈</span>
            <button
              onClick={submit}
              disabled={!input.trim() || isLoading || !hasApiKey}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-30 rounded"
              style={{ background: "#007acc", color: "#fff" }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "#1177bb" }}
              onMouseLeave={e => (e.currentTarget.style.background = "#007acc")}
            >
              {isLoading ? <Spinner /> : <>↑ 실행</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}