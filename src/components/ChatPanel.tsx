import { useState, useRef, useEffect } from 'react'
import { ArrowUp, RotateCcw, AlertCircle, FileText, ImagePlus, X, Square } from 'lucide-react'
import ClaudeIcon from './ClaudeIcon'
import type { Message, MessageImage, TokenUsage } from '../services/ai'
import { imageSrc, MAX_IMAGES_PER_MESSAGE, readImage } from '../services/image'
import { formatUsd } from '../services/usage'
import type { UsageTotals } from '../services/usage'

// 실제 잔액·청구액은 일반 API 키로 조회할 수 없어 Console 대시보드로 안내한다.
const BILLING_URL = 'https://platform.claude.com/dashboard'

// 빈 대화 화면의 픽셀 마스코트. 몸통·팔·다리는 강조색, 눈은 테마와 상관없이 짙은 색으로 고정한다.
function ClaudeMascot() {
  return (
    <svg viewBox="0 0 16 10" width={64} height={40} shapeRendering="crispEdges" aria-hidden="true">
      <g fill="var(--accent)">
        <rect x="2" y="0" width="12" height="8" />
        <rect x="0" y="3" width="2" height="2" />
        <rect x="14" y="3" width="2" height="2" />
        <rect x="3" y="8" width="1" height="2" />
        <rect x="5" y="8" width="1" height="2" />
        <rect x="10" y="8" width="1" height="2" />
        <rect x="12" y="8" width="1" height="2" />
      </g>
      <g fill="#141413">
        <rect x="4" y="2" width="1" height="2" />
        <rect x="11" y="2" width="1" height="2" />
      </g>
    </svg>
  )
}

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
  onSend: (prompt: string, images: MessageImage[]) => void
  // 생성 중에 전송 버튼 자리의 중지 버튼이 부른다.
  onStop: () => void
  isLoading: boolean
  hasApiKey: boolean
  width?: number
  tokenUsage?: TokenUsage | null
  // 마지막 요청의 예상 비용(USD)과 이 브라우저의 오늘·누적 합계
  lastCost: number
  usageTotals: UsageTotals
  onResetUsage: () => void
  // Claude 답변 본문은 오른쪽 패널에 표시하고, 여기서는 카드로만 보여준다.
  activeAnswerIndex: number | null
  // 새 대화 시작. 페이지를 새로고침하지 않고 화면 상태만 비운다.
  onNewChat: () => void
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

export default function ChatPanel({ messages, onSend, onStop, isLoading, hasApiKey, width, tokenUsage, lastCost, usageTotals, onResetUsage, activeAnswerIndex, onOpenAnswer, onNewChat }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  // 보내기 전 이미지(🖼 버튼·붙여넣기·끌어다 놓기로 추가)
  const [images, setImages] = useState<MessageImage[]>([])
  const [imageError, setImageError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // 남은 칸만큼만 받고, 형식이 맞지 않거나 읽기에 실패한 파일은 메시지로 알린다.
  const addImageFiles = async (files: File[]) => {
    if (files.length === 0) return
    setImageError('')
    const room = MAX_IMAGES_PER_MESSAGE - images.length
    if (files.length > room) setImageError(`이미지는 메시지당 최대 ${MAX_IMAGES_PER_MESSAGE}장까지 넣을 수 있어요`)
    const added: MessageImage[] = []
    for (const file of files.slice(0, Math.max(0, room))) {
      try {
        added.push(await readImage(file))
      } catch (err) {
        setImageError(err instanceof Error ? err.message : '이미지를 읽지 못했어요')
      }
    }
    if (added.length > 0) setImages((prev) => [...prev, ...added].slice(0, MAX_IMAGES_PER_MESSAGE))
  }

  // 클립보드에 이미지가 있을 때만 가로채고, 글자 붙여넣기는 그대로 둔다.
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files)
    if (files.length === 0) return
    e.preventDefault()
    void addImageFiles(files)
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    void addImageFiles(Array.from(e.dataTransfer.files))
  }

  const submit = () => {
    const t = input.trim()
    if ((!t && images.length === 0) || isLoading || !hasApiKey) return
    onSend(t, images); setInput(''); setImages([]); setImageError('')
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

  const canSend = (!!input.trim() || images.length > 0) && !isLoading && hasApiKey

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
          <button onClick={onNewChat} disabled={isLoading}
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
              <ClaudeMascot />
              <div className="text-center">
                <p style={{ color: 'var(--txt)', fontFamily: 'var(--display-font)', fontSize: 20, fontWeight: 600, marginBottom: 6 }}>
                  무엇을 만들어 볼까요?
                </p>
                <p style={{ color: 'var(--txt-3)', fontSize: 'var(--fs-sm)' }}>
                  아이디어를 설명하면 Claude가 디자인 방향을 먼저 제안하고 코드로 만들어 드려요
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
                <div key={i} className="flex flex-col items-end gap-1.5">
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap justify-end gap-1.5" style={{ maxWidth: '85%' }}>
                      {msg.images.map((img, k) => (
                        <img key={k} src={imageSrc(img)} alt={`첨부 이미지 ${k + 1}`} className="chat-image" />
                      ))}
                    </div>
                  )}
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
                  <ClaudeIcon size={16} style={{ color: 'var(--accent)', marginTop: 12 }} />
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
                <ClaudeIcon size={16} style={{ color: 'var(--accent)', marginTop: 3 }} />
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
        {imageError && (
          <p role="alert" style={{ color: 'var(--err)', fontSize: 'var(--fs-xs)', margin: '0 4px 6px' }}>{imageError}</p>
        )}
        <div className="transition-all"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          style={{
            background: 'var(--bg-panel)',
            border: `1px solid ${input || images.length > 0 ? 'var(--accent-bd)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 1px 3px rgba(20,20,19,0.06)',
          }}>
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2" style={{ padding: '10px 12px 0' }}>
              {images.map((img, k) => (
                <div key={k} className="relative">
                  <img src={imageSrc(img)} alt={`보낼 이미지 ${k + 1}`} className="chat-image-draft" />
                  <button onClick={() => setImages((prev) => prev.filter((_, j) => j !== k))}
                    aria-label={`이미지 ${k + 1} 빼기`} className="chat-image-remove">
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea ref={taRef} value={input}
            onChange={onInput} onKeyDown={onKey} onPaste={onPaste}
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
            <span className="flex items-center gap-2">
              <button onClick={() => fileInputRef.current?.click()}
                disabled={!hasApiKey || isLoading || images.length >= MAX_IMAGES_PER_MESSAGE}
                aria-label="이미지 추가" title="이미지 추가 (붙여넣기·끌어다 놓기도 됩니다)"
                className="icon-btn" style={{ width: 28, height: 28 }}>
                <ImagePlus style={{ width: 16, height: 16 }} />
              </button>
              <input ref={fileInputRef} type="file" hidden multiple
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={(e) => { void addImageFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
              <span style={{ color: 'var(--txt-3)', fontSize: 'var(--fs-xs)' }}>
                Shift+Enter 줄바꿈
              </span>
            </span>
            <button onClick={isLoading ? onStop : submit} disabled={!isLoading && !canSend}
              aria-label={isLoading ? '생성 중지' : '전송'}
              title={isLoading ? '생성 중지' : undefined}
              className="flex items-center justify-center transition-colors"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: canSend || isLoading ? 'var(--accent)' : 'var(--bg-hover)',
                color: canSend || isLoading ? 'var(--on-accent)' : 'var(--txt-3)',
                border: 'none',
                cursor: canSend || isLoading ? 'pointer' : 'default',
              }}
              onMouseEnter={e => { if (canSend || isLoading) e.currentTarget.style.background = 'var(--accent-h)' }}
              onMouseLeave={e => { if (canSend || isLoading) e.currentTarget.style.background = 'var(--accent)' }}>
              {isLoading
                ? <Square style={{ width: 12, height: 12 }} fill="currentColor" />
                : <ArrowUp style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        </div>
      </div>

      {/* 사용량: 이번 요청 + 이 브라우저의 오늘·누적 예상 비용. 비용은 단가로 계산한 근사값이다. */}
      {(tokenUsage || usageTotals.totalTokens > 0) && (
        <div className="flex-shrink-0 px-4 pb-3 flex flex-col gap-0.5"
          style={{ color: 'var(--txt-3)', fontSize: 'var(--fs-xs)', fontVariantNumeric: 'tabular-nums' }}>
          {tokenUsage && (
            <span>
              이번 in {tokenUsage.promptTokens.toLocaleString()} · out {tokenUsage.completionTokens.toLocaleString()} · 약 {formatUsd(lastCost)}
            </span>
          )}
          <span className="flex items-center gap-2 flex-wrap">
            <span title="이 브라우저에서 보낸 요청만 합산한 예상 비용입니다">
              오늘 약 {formatUsd(usageTotals.todayCost)} · 누적 약 {formatUsd(usageTotals.totalCost)}
            </span>
            <button onClick={onResetUsage}
              style={{ color: 'var(--txt-2)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>
              초기화
            </button>
            <a href={BILLING_URL} target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
              실제 잔액 보기
            </a>
          </span>
        </div>
      )}
    </div>
  )
}