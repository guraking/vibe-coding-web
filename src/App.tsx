import { useState, useRef } from 'react'
import Header from './components/Header'
import ChatPanel from './components/ChatPanel'
import PreviewPanel from './components/PreviewPanel'
import { streamCode, parseVibe } from './services/ai'
import type { Message } from './services/ai'

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [previewHtml, setPreviewHtml] = useState('')
  const [currentCode, setCurrentCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('vibe_api_key') ?? '')
  const [model, setModel] = useState(() => localStorage.getItem('vibe_model') ?? 'gpt-4o')
  const bufferRef = useRef('')

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

    // Placeholder assistant message
    const assistantPlaceholder: Message = { role: 'assistant', content: '', html: '' }
    setMessages([...history, assistantPlaceholder])

    try {
      for await (const chunk of streamCode(apiKey, model, history, currentCode || undefined)) {
        bufferRef.current += chunk
        const { explanation } = parseVibe(bufferRef.current)

        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: explanation || '생성 중...',
            html: '',
          }
          return updated
        })
      }

      // Final parse
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
        updated[updated.length - 1] = {
          role: 'assistant',
          content: `❌ 오류: ${message}`,
          html: '',
        }
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      <Header
        apiKey={apiKey}
        model={model}
        onApiKeyChange={handleApiKeyChange}
        onModelChange={handleModelChange}
      />
      <div className="flex flex-1 overflow-hidden">
        <ChatPanel
          messages={messages}
          onSend={handleSend}
          isLoading={isLoading}
          hasApiKey={!!apiKey}
        />
        <PreviewPanel html={previewHtml} code={currentCode} isLoading={isLoading} />
      </div>
    </div>
  )
}
