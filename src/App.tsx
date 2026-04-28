import { useState, useRef } from 'react'
import Header from './components/Header'
import ChatPanel from './components/ChatPanel'
import PreviewPanel from './components/PreviewPanel'
import { streamCode, parseVibe } from './services/ai'
import type { Message } from './services/ai'

const activityIcons = [
  { icon: '💬', title: 'Chat', active: true },
  { icon: '🔍', title: '검색', active: false },
  { icon: '⎇', title: 'Git', active: false },
  { icon: '🧩', title: '확장', active: false },
]

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [previewHtml, setPreviewHtml] = useState('')
  const [currentCode, setCurrentCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  // .env.local의 VITE_OPENAI_API_KEY를 우선 사용, 없으면 localStorage fallback
  const envKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined
  const [apiKey, setApiKey] = useState(() => envKey?.trim() || localStorage.getItem('vibe_api_key') || '')
  const [model, setModel] = useState(() => localStorage.getItem('vibe_model') ?? 'gpt-4o')
  const bufferRef = useRef('')
  const isEnvKey = Boolean(envKey?.trim())

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
    const placeholder: Message = { role: 'assistant', content: '', html: '' }
    setMessages([...history, placeholder])
    try {
      for await (const chunk of streamCode(apiKey, model, history, currentCode || undefined)) {
        bufferRef.current += chunk
        const { explanation } = parseVibe(bufferRef.current)
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: explanation || '생성 중...', html: '' }
          return updated
        })
      }
      const { html, explanation } = parseVibe(bufferRef.current)
      const finalHtml = html || bufferRef.current
      setPreviewHtml(finalHtml)
      setCurrentCode(finalHtml)
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: explanation || '완성됐습니다! 코드 탭에서 소스를 확인할 수 있어요.',
          html: finalHtml,
        }
        return updated
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다'
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: `오류: ${message}`, html: '' }
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#1e1e1e', color: '#cccccc' }}>
      <Header apiKey={apiKey} model={model} onApiKeyChange={handleApiKeyChange} onModelChange={handleModelChange} isEnvKey={isEnvKey} />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col items-center py-1 flex-shrink-0" style={{ width: 48, background: '#333333', borderRight: '1px solid #252526' }}>
          {activityIcons.map((item) => (
            <button
              key={item.title}
              title={item.title}
              className="flex items-center justify-center w-12 h-12 text-xl transition-colors"
              style={{ color: item.active ? '#cccccc' : '#858585', borderLeft: item.active ? '2px solid #cccccc' : '2px solid transparent' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#cccccc')}
              onMouseLeave={e => (e.currentTarget.style.color = item.active ? '#cccccc' : '#858585')}
            >
              {item.icon}
            </button>
          ))}
        </div>
        <ChatPanel messages={messages} onSend={handleSend} isLoading={isLoading} hasApiKey={!!apiKey} />
        <PreviewPanel html={previewHtml} code={currentCode} isLoading={isLoading} />
      </div>
    </div>
  )
}
