import { useState, useRef, useCallback, useEffect } from 'react'
import Header from './components/Header'
import ChatPanel from './components/ChatPanel'
import PreviewPanel from './components/PreviewPanel'
import { streamCode, parseVibe, RateLimitError, getDefaultModel, getModelsByProvider } from './services/ai'
import type { Message, TokenUsage } from './services/ai'
import type { AIProvider } from './services/ai'

function isLikelyMarkup(text: string): boolean {
  return /<!doctype|<html|<body|<main|<div|<section|<script|<style/i.test(text)
}

function isValidGeneratedProject(files: Record<string, string>, projectType: 'html' | 'react' | 'vue'): boolean {
  if (Object.keys(files).length === 0) return false
  if (projectType === 'html') {
    return Boolean(files['index.html']) && isLikelyMarkup(files['index.html'])
  }
  if (projectType === 'react') {
    const hasMain = Boolean(files['src/main.jsx'] || files['src/main.tsx'])
    const hasApp = Boolean(files['src/App.jsx'] || files['src/App.tsx'])
    return Boolean(files['package.json']) && hasMain && hasApp
  }
  const hasMain = Boolean(files['src/main.js'] || files['src/main.ts'])
  return Boolean(files['package.json']) && hasMain && Boolean(files['src/App.vue'])
}

function fingerprintFiles(files: Record<string, string>): string {
  const names = Object.keys(files).sort()
  return names.map((name) => `${name}:${files[name]?.length ?? 0}`).join('|')
}

const REALTIME_PATCH_THROTTLE_MS = 150

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({})
  const projectFilesRef = useRef<Record<string, string>>({})
  const [projectType, setProjectType] = useState<'html' | 'react' | 'vue'>('html')
  const [isLoading, setIsLoading] = useState(false)
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null)
  // timestamp(ms) until which requests are blocked due to rate limit
  const [retryAt, setRetryAt] = useState<number | null>(null)

  // clear retryAt once time passes
  useEffect(() => {
    if (!retryAt) return
    const remaining = retryAt - Date.now()
    if (remaining <= 0) { setRetryAt(null); return }
    const t = setTimeout(() => setRetryAt(null), remaining)
    return () => clearTimeout(t)
  }, [retryAt])
  const envKeys: Record<AIProvider, string> = {
    groq: (import.meta.env.VITE_GROQ_API_KEY as string | undefined)?.trim() || '',
    openai: (import.meta.env.VITE_OPENAI_API_KEY as string | undefined)?.trim() || '',
    gemini: (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() || '',
  }
  const [provider, setProvider] = useState<AIProvider>(() => {
    const saved = localStorage.getItem('vibe_provider') as AIProvider | null
    return saved === 'groq' || saved === 'openai' || saved === 'gemini' ? saved : 'groq'
  })
  const [apiKeys, setApiKeys] = useState<Record<AIProvider, string>>(() => ({
    groq: envKeys.groq || localStorage.getItem('vibe_api_key_groq') || '',
    openai: envKeys.openai || localStorage.getItem('vibe_api_key_openai') || '',
    gemini: envKeys.gemini || localStorage.getItem('vibe_api_key_gemini') || '',
  }))
  const pickInitialModel = (targetProvider: AIProvider) => {
    const saved = localStorage.getItem(`vibe_model_${targetProvider}`)
    const available = getModelsByProvider(targetProvider)
    if (saved && available.some((m) => m.id === saved)) return saved
    return getDefaultModel(targetProvider)
  }
  const [modelByProvider, setModelByProvider] = useState<Record<AIProvider, string>>(() => ({
    groq: pickInitialModel('groq'),
    openai: pickInitialModel('openai'),
    gemini: pickInitialModel('gemini'),
  }))
  const bufferRef = useRef('')
  const lastRealtimePatchRef = useRef('')
  const lastRealtimePatchAtRef = useRef(0)
  const realtimePatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRealtimePatchRef = useRef<{
    files: Record<string, string>
    projectType: 'html' | 'react' | 'vue'
    fingerprint: string
  } | null>(null)
  const isEnvKeyByProvider: Record<AIProvider, boolean> = {
    groq: Boolean(envKeys.groq),
    openai: Boolean(envKeys.openai),
    gemini: Boolean(envKeys.gemini),
  }
  const activeApiKey = apiKeys[provider]
  const activeModel = modelByProvider[provider]

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

  const applyRealtimePatch = useCallback((
    files: Record<string, string>,
    pType: 'html' | 'react' | 'vue',
    fingerprint: string,
  ) => {
    lastRealtimePatchRef.current = fingerprint
    lastRealtimePatchAtRef.current = Date.now()
    projectFilesRef.current = files
    setProjectFiles(files)
    setProjectType(pType)
  }, [])

  const flushPendingRealtimePatch = useCallback(() => {
    const pending = pendingRealtimePatchRef.current
    if (!pending) return
    pendingRealtimePatchRef.current = null
    applyRealtimePatch(pending.files, pending.projectType, pending.fingerprint)
  }, [applyRealtimePatch])

  useEffect(() => {
    return () => {
      if (realtimePatchTimerRef.current) {
        clearTimeout(realtimePatchTimerRef.current)
        realtimePatchTimerRef.current = null
      }
    }
  }, [])

  const handleApiKeyChange = (targetProvider: AIProvider, key: string) => {
    setApiKeys((prev) => ({ ...prev, [targetProvider]: key }))
    localStorage.setItem(`vibe_api_key_${targetProvider}`, key)
  }

  const handleProviderChange = (next: AIProvider) => {
    setProvider(next)
    localStorage.setItem('vibe_provider', next)
  }

  const handleModelChange = (targetProvider: AIProvider, nextModel: string) => {
    setModelByProvider((prev) => ({ ...prev, [targetProvider]: nextModel }))
    localStorage.setItem(`vibe_model_${targetProvider}`, nextModel)
  }

  const handleSend = async (prompt: string) => {
    if (!activeApiKey || isLoading || (provider === 'groq' && retryAt)) return
    const userMsg: Message = { role: 'user', content: prompt }
    const history = [...messages, userMsg]
    setMessages(history)
    setIsLoading(true)
    bufferRef.current = ''
    lastRealtimePatchRef.current = ''
    lastRealtimePatchAtRef.current = 0
    pendingRealtimePatchRef.current = null
    if (realtimePatchTimerRef.current) {
      clearTimeout(realtimePatchTimerRef.current)
      realtimePatchTimerRef.current = null
    }
    const placeholder: Message = { role: 'assistant', content: '', files: {} }
    setMessages([...history, placeholder])
    try {
      for await (const chunk of streamCode(provider, activeApiKey, activeModel, history, Object.keys(projectFiles).length ? projectFiles : undefined, setTokenUsage)) {
        bufferRef.current += chunk
        const parsedChunk = parseVibe(bufferRef.current)
        const { explanation } = parsedChunk

        // Realtime patch: reflect generated files in Code tab while streaming.
        if (Object.keys(parsedChunk.files).length > 0) {
          const nextFingerprint = fingerprintFiles(parsedChunk.files)
          if (nextFingerprint !== lastRealtimePatchRef.current) {
            const elapsed = Date.now() - lastRealtimePatchAtRef.current
            if (elapsed >= REALTIME_PATCH_THROTTLE_MS) {
              applyRealtimePatch(parsedChunk.files, parsedChunk.projectType, nextFingerprint)
            } else {
              pendingRealtimePatchRef.current = {
                files: parsedChunk.files,
                projectType: parsedChunk.projectType,
                fingerprint: nextFingerprint,
              }
              if (!realtimePatchTimerRef.current) {
                const wait = Math.max(0, REALTIME_PATCH_THROTTLE_MS - elapsed)
                realtimePatchTimerRef.current = setTimeout(() => {
                  realtimePatchTimerRef.current = null
                  flushPendingRealtimePatch()
                }, wait)
              }
            }
          }
        }

        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: explanation || '생성 중...', files: {} }
          return updated
        })
      }

      flushPendingRealtimePatch()

      let parsed = parseVibe(bufferRef.current)

      // 일부 모델이 설명문 위주로 응답하는 경우 한 번 자동 보정 재시도
      if (!isValidGeneratedProject(parsed.files, parsed.projectType)) {
        const repairPrompt = [
          '아래 원문 응답은 형식이 깨졌거나 코드가 부족합니다.',
          '반드시 <VIBE_FILE>, <VIBE_TYPE>, <VIBE_EXPLANATION> 형식으로만 다시 출력하세요.',
          '실제 실행 가능한 완성 코드(디자인+기능 포함)로 생성하고 설명문만 보내지 마세요.',
          '',
          '[원문 응답 시작]',
          bufferRef.current,
          '[원문 응답 끝]',
        ].join('\n')

        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: '응답 형식 보정 중... (코드 구조 자동 재생성)',
            files: {},
          }
          return updated
        })

        let repairedRaw = ''
        for await (const chunk of streamCode(
          provider,
          activeApiKey,
          activeModel,
          [{ role: 'user', content: repairPrompt }],
          Object.keys(projectFiles).length ? projectFiles : undefined,
          setTokenUsage,
        )) {
          repairedRaw += chunk
        }

        const repaired = parseVibe(repairedRaw)
        if (isValidGeneratedProject(repaired.files, repaired.projectType)) {
          parsed = repaired
          bufferRef.current = repairedRaw
        }
      }

      const { files, explanation, projectType: pType } = parsed
      if (Object.keys(files).length > 0) {
        projectFilesRef.current = files
        setProjectFiles(files)
        setProjectType(pType)
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
      pendingRealtimePatchRef.current = null
      if (realtimePatchTimerRef.current) {
        clearTimeout(realtimePatchTimerRef.current)
        realtimePatchTimerRef.current = null
      }
      if (provider === 'groq' && err instanceof RateLimitError) {
        setRetryAt(Date.now() + err.retryAfterSeconds * 1000)
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: `__RATELIMIT__${err.retryAfterSeconds}__${err.limitTokens}__${err.usedTokens}`,
            files: {},
          }
          return updated
        })
      } else {
        const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다'
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: `오류: ${message}`, files: {} }
          return updated
        })
      }
    } finally {
      pendingRealtimePatchRef.current = null
      if (realtimePatchTimerRef.current) {
        clearTimeout(realtimePatchTimerRef.current)
        realtimePatchTimerRef.current = null
      }
      setIsLoading(false)
    }
  }

  const [activeToolWindow, setActiveToolWindow] = useState<'chat' | null>('chat')

  const commonImport = (importedFiles: Record<string, string>, importedType: 'html' | 'react' | 'vue') => {
    projectFilesRef.current = importedFiles
    setProjectFiles(importedFiles)
    setProjectType(importedType)
  }

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
      <Header
        provider={provider}
        apiKeys={apiKeys}
        model={activeModel}
        onProviderChange={handleProviderChange}
        onApiKeyChange={handleApiKeyChange}
        onModelChange={handleModelChange}
        isEnvKeyByProvider={isEnvKeyByProvider}
      />
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
            <ChatPanel
              messages={messages}
              onSend={handleSend}
              isLoading={isLoading}
              hasApiKey={!!activeApiKey}
              width={chatWidth}
              tokenUsage={tokenUsage}
              retryAt={provider === 'groq' ? retryAt : null}
            />
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

        <PreviewPanel
          files={projectFiles}
          projectType={projectType}
          isLoading={isLoading}
          onImport={commonImport}
        />
      </div>
    </div>
  )
}
