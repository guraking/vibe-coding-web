import { useState, useRef, useEffect } from 'react'
import { ArrowUp, RotateCcw, AlertCircle, Sparkle, FileText } from 'lucide-react'
import type { Message, TokenUsage } from '../services/ai'

/**
 * ChatPanel 컴포넌트: 좌측 채팅 패널
 * 
 * 주요 기능:
 * - AI에 프롬프트 전송 (Shift+Enter로 개행)
 * - 채팅 메시지 히스토리 표시 (사용자/AI)
 * - 토큰 사용량 실시간 추적
 * - 빠른 시작 제안 버튼 (empty state)
 * - 새 세션 시작 버튼 (refresh)
 */
interface Props {
  messages: Message[]
  onSend: (prompt: string) => void
  isLoading: boolean
  hasApiKey: boolean
  width?: number
  tokenUsage?: TokenUsage | null
  // Claude 답변 본문은 오른쪽 패널에 표시하고, 여기서는 카드로만 보여준다.
  activeAnswerIndex: number | null
  onOpenAnswer: (index: number) => void
}

// 카드 제목: 답변 첫 줄에서 마크다운 기호를 걷어낸 텍스트
function answerTitle(content: string): string {
  const line = content.split('\n').find((l) => l.trim()) ?? ''
  return line.replace(/^[#>*\-\s`]+/, '').replace(/[*`]/g, '').trim()
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

/**
 * 로딩 상태를 나타내는 애니메이션 점 표시
 * 스트리밍 중 AI가 응답을 생성 중임을 시각적으로 표현
 */
function Dots() {
  return (
    <span className="inline-flex gap-1.5 items-center py-1">
      {Array.from({ length: 3 }).map((_, i) => (
        <span
          key={i}
          className="pixel-loader-cell"
          style={{ width: 6, height: 6, animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  )
}

export default function ChatPanel({ messages, onSend, isLoading, hasApiKey, width, tokenUsage, activeAnswerIndex, onOpenAnswer }: Props) {
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
        width: width ?? '100%',
        minWidth: width ? 220 : undefined,
        maxWidth: width ? '60vw' : undefined,
        background: 'var(--bg-panel)',
        flex: width ? undefined : '1',
      }}>

      {/* Section header */}
      <div className="flex items-center justify-between px-4 flex-shrink-0"
        style={{ height: 44, borderBottom: '1px solid var(--border-s)' }}>
        <span style={{ color: 'var(--txt)', fontSize: 'var(--fs-md)', fontWeight: 600 }}>대화</span>
        {messages.length > 0 && (
          <button onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 transition-colors"
            style={{ color: 'var(--txt-2)', fontSize: 'var(--fs-sm)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--txt)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt-2)'; e.currentTarget.style.background = 'none' }}>
            <RotateCcw style={{ width: 12, height: 12 }} />
            <span>새 대화</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col h-full">
            {/* Empty state */}
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
              <Sparkle style={{ width: 28, height: 28, color: 'var(--accent)' }} fill="currentColor" />
              <div className="text-center">
                <p style={{ color: 'var(--txt)', fontFamily: 'var(--display-font)', fontSize: 20, fontWeight: 600, marginBottom: 6 }}>
                  무엇을 만들어 볼까요?
                </p>
                <p style={{ color: 'var(--txt-3)', fontSize: 'var(--fs-sm)' }}>
                  아이디어를 설명하면 Claude가 바로 코드로 만들어 드려요
                </p>
              </div>
            </div>

            {/* Suggestions */}
            <div className="px-4 pb-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map(s => (
                <button key={s.label}
                  onClick={() => { setInput(s.desc); taRef.current?.focus() }}
                  className="transition-colors"
                  style={{
                    padding: '6px 12px',
                    fontSize: 'var(--fs-sm)',
                    color: 'var(--txt-2)',
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 999,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-bd)'; e.currentTarget.style.color = 'var(--txt)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--txt-2)' }}>
                  {s.desc}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col px-4 py-4 gap-4">
            {messages.map((msg, i) => (
              msg.role === 'user' ? (
                /* 사용자 메시지: 오른쪽 말풍선 */
                <div key={i} className="flex justify-end">
                  <p style={{
                    maxWidth: '85%',
                    padding: '8px 14px',
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-lg)',
                    color: 'var(--txt)',
                    fontSize: 'var(--fs-md)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {msg.content}
                  </p>
                </div>
              ) : (
                /* Claude 메시지: 본문은 오른쪽 패널, 여기서는 여는 카드. 오류는 카드 없이 바로 보여준다. */
                <div key={i} className="flex gap-2.5 min-w-0">
                  <Sparkle aria-hidden="true" style={{ width: 16, height: 16, color: 'var(--accent)', flexShrink: 0, marginTop: 12 }} fill="currentColor" />
                  {!msg.content
                    ? <Dots />
                    : msg.content.startsWith('오류:')
                      ? <p style={{ color: 'var(--err)', fontSize: 'var(--fs-md)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingTop: 8 }}>{msg.content}</p>
                      : (
                        <button onClick={() => onOpenAnswer(i)}
                          className="flex items-center gap-3 text-left min-w-0 flex-1 transition-colors"
                          aria-pressed={activeAnswerIndex === i}
                          style={{
                            padding: '10px 12px',
                            background: activeAnswerIndex === i ? 'var(--bg-card)' : 'var(--bg-panel)',
                            border: `1px solid ${activeAnswerIndex === i ? 'var(--accent-bd)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                          }}>
                          <FileText style={{ width: 18, height: 18, color: 'var(--txt-2)', flexShrink: 0 }} />
                          <span className="flex flex-col min-w-0">
                            <span className="truncate" style={{ color: 'var(--txt)', fontSize: 'var(--fs-md)', fontWeight: 500 }}>
                              {answerTitle(msg.content) || '답변'}
                            </span>
                            <span style={{ color: 'var(--txt-3)', fontSize: 'var(--fs-xs)' }}>
                              {msg.files && Object.keys(msg.files).length > 0
                                ? `파일 ${Object.keys(msg.files).length}개 · 눌러서 보기`
                                : '눌러서 답변 보기'}
                            </span>
                          </span>
                        </button>
                      )}
                </div>
              )
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-2.5">
                <Sparkle aria-hidden="true" style={{ width: 16, height: 16, color: 'var(--accent)', flexShrink: 0, marginTop: 3 }} fill="currentColor" />
                <Dots />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-3 pb-3 pt-2">
        {!hasApiKey && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2"
            style={{ background: 'var(--err-bg)', border: '1px solid var(--err-bd)', borderRadius: 'var(--radius-md)', color: 'var(--err)', fontSize: 'var(--fs-sm)' }}>
            <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
            API 키가 없습니다. 상단의 API 키 버튼에서 입력해 주세요.
          </div>
        )}
        <div className="transition-all"
          style={{
            background: 'var(--bg-panel)',
            border: `1px solid ${input ? 'var(--accent-bd)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 1px 3px rgba(20,20,19,0.06)',
          }}>
          <textarea ref={taRef} value={input}
            onChange={onInput} onKeyDown={onKey}
            aria-label="메시지 입력"
            placeholder={hasApiKey ? '만들고 싶은 것을 설명해 주세요' : 'API 키를 먼저 설정해 주세요'}
            disabled={!hasApiKey || isLoading} rows={2}
            className="w-full bg-transparent resize-none disabled:opacity-40"
            style={{
              display: 'block',
              padding: '12px 14px 4px',
              color: 'var(--txt)',
              fontSize: 'var(--fs-md)',
              lineHeight: 1.6,
              minHeight: 52,
              maxHeight: 180,
              border: 'none',
              outline: 'none',
              caretColor: 'var(--accent)',
            }}
          />
          <div className="flex items-center justify-between px-3 pb-2.5">
            <span style={{ color: 'var(--txt-3)', fontSize: 'var(--fs-xs)' }}>
              Shift+Enter 줄바꿈
            </span>
            <button onClick={submit} disabled={!canSend}
              aria-label={isLoading ? '생성 중' : '전송'}
              className="flex items-center justify-center transition-colors"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: canSend ? 'var(--accent)' : 'var(--bg-hover)',
                color: canSend ? 'white' : 'var(--txt-3)',
                border: 'none',
                cursor: canSend ? 'pointer' : 'default',
              }}
              onMouseEnter={e => { if (canSend) e.currentTarget.style.background = 'var(--accent-h)' }}
              onMouseLeave={e => { if (canSend) e.currentTarget.style.background = 'var(--accent)' }}>
              {isLoading
                ? <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.9s linear infinite' }} />
                : <ArrowUp style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        </div>
      </div>

      {/* 마지막 요청의 토큰 사용량 */}
      {tokenUsage && (
        <p className="flex-shrink-0 px-4 pb-3" style={{ color: 'var(--txt-3)', fontSize: 'var(--fs-xs)', fontVariantNumeric: 'tabular-nums' }}>
          in {tokenUsage.promptTokens.toLocaleString()} · out {tokenUsage.completionTokens.toLocaleString()} · 총 {tokenUsage.totalTokens.toLocaleString()} 토큰
        </p>
      )}
    </div>
  )
}