import { useState, useRef, useCallback, useEffect } from 'react'
import Header from './components/Header'
import ChatPanel from './components/ChatPanel'
import PreviewPanel from './components/PreviewPanel'
import { streamCode, parseVibe } from './services/ai'
import type { Message } from './services/ai'
import { useServiceWorker } from './hooks/useServiceWorker'

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({})
  const projectFilesRef = useRef<Record<string, string>>({})
  const [previewVersion, setPreviewVersion] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const { ready: swReady, sendFiles } = useServiceWorker()

  // SW 준비되면 현재 파일을 재전송해서 미리보기 복원
  useEffect(() => {
    if (!swReady) return
    const files = projectFilesRef.current
    if (Object.keys(files).length === 0) return
    sendFiles(files).then(() => setPreviewVersion(v => v + 1)).catch(console.error)
  }, [swReady])
  // .env.local의 VITE_OPENAI_API_KEY를 우선 사용, 없으면 localStorage fallback
  const envKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined
  const [apiKey, setApiKey] = useState(() => envKey?.trim() || localStorage.getItem('vibe_api_key') || '')
  const [model, setModel] = useState(() => localStorage.getItem('vibe_model') ?? 'llama-3.3-70b-versatile')
  const bufferRef = useRef('')
  const isEnvKey = Boolean(envKey?.trim())

  // 드래그 리사이저
  const [chatWidth, setChatWidth] = useState(340)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = chatWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [chatWidth])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const delta = e.clientX - startX.current
    const next = Math.max(200, Math.min(startWidth.current + delta, window.innerWidth * 0.6))
    setChatWidth(next)
  }, [])

  const onMouseUp = useCallback(() => {
    isDragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  const handleApiKeyChange = (key: string) => {
    setApiKey(key)
    localStorage.setItem('vibe_api_key', key)
  }

  const handleModelChange = (m: string) => {
    setModel(m)
    localStorage.setItem('vibe_model', m)
  }

  const handleSend = async (prompt: string) => {
    if (!apiKey || isLoading) return
    const userMsg: Message = { role: 'user', content: prompt }
    const history = [...messages, userMsg]
    setMessages(history)
    setIsLoading(true)
    bufferRef.current = ''
    const placeholder: Message = { role: 'assistant', content: '', files: {} }
    setMessages([...history, placeholder])
    try {
      for await (const chunk of streamCode(apiKey, model, history, Object.keys(projectFiles).length ? projectFiles : undefined)) {
        bufferRef.current += chunk
        const { explanation } = parseVibe(bufferRef.current)
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: explanation || '생성 중...', files: {} }
          return updated
        })
      }
      const { files, explanation } = parseVibe(bufferRef.current)
      if (Object.keys(files).length > 0) {
        projectFilesRef.current = files
        setProjectFiles(files)
        if (swReady) {
          await sendFiles(files).catch(console.error)
          setPreviewVersion(v => v + 1)
        }
        // SW not ready yet → the swReady useEffect will handle it
      }
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: explanation || '완성됐습니다! 코드 탭에서 소스를 확인할 수 있어요.',
          files,
        }
        return updated
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다'
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: `오류: ${message}`, files: {} }
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }

  const [activeToolWindow, setActiveToolWindow] = useState<'chat' | null>('chat')

  const toolWindowIcons = [
    {
      id: 'chat' as const,
      title: 'AI Chat',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.9"/>
          <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.6"/>
          <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.6"/>
          <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.3"/>
        </svg>
      ),
    },
    {
      id: null as null,
      title: 'Structure',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M2 8h8M2 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
    },
  ]

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <Header apiKey={apiKey} model={model} onApiKeyChange={handleApiKeyChange} onModelChange={handleModelChange} isEnvKey={isEnvKey} />
      <div className="flex flex-1 overflow-hidden">
        {/* Left narrow tool window bar (IntelliJ style) */}
        <div
          className="flex flex-col items-center py-1 flex-shrink-0 gap-0.5"
          style={{ width: 36, background: 'var(--bg-panel)', borderRight: '1px solid var(--border)' }}
        >
          {toolWindowIcons.map((item, i) => (
            <button
              key={i}
              title={item.title}
              onClick={() => item.id !== undefined && setActiveToolWindow(activeToolWindow === item.id ? null : item.id)}
              className="w-7 h-7 flex items-center justify-center rounded transition-colors"
              style={{
                color: activeToolWindow === item.id ? 'var(--accent)' : 'var(--txt-3)',
                background: activeToolWindow === item.id ? 'var(--accent-bg)' : 'transparent',
              }}
              onMouseEnter={e => { if (activeToolWindow !== item.id) e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { if (activeToolWindow !== item.id) e.currentTarget.style.background = 'transparent' }}
            >
              {item.icon}
            </button>
          ))}
        </div>

        {/* Chat panel (collapsible) */}
        {activeToolWindow === 'chat' && (
          <>
            <ChatPanel messages={messages} onSend={handleSend} isLoading={isLoading} hasApiKey={!!apiKey} width={chatWidth} />
            {/* Drag handle */}
            <div
              onMouseDown={onMouseDown}
              style={{
                width: 1,
                flexShrink: 0,
                background: 'var(--border)',
                cursor: 'col-resize',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
              onMouseLeave={e => { if (!isDragging.current) e.currentTarget.style.background = 'var(--border)' }}
            />
          </>
        )}

        <PreviewPanel files={projectFiles} previewVersion={previewVersion} isLoading={isLoading} swReady={swReady} />
      </div>
    </div>
  )
}
