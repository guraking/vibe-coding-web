/**
 * 메인 애플리케이션 컴포넌트
 * 
 * 기능:
 * - AI 챗 인터페이스 (좌측)
 * - 코드 미리보기 패널 (우측)
 * - 리얼타임 코드 스트리밍 및 렌더링
 * - Claude API (Anthropic) 기반 코드 생성
 * - 프로젝트 타입 자동 감지 (HTML, React, Vue)
 * - 드래그 가능한 패널 리사이저
 */

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { PanelLeft } from 'lucide-react'
import Sidebar from './components/Sidebar'  // 좌측 대화 목록
import { chatTitle, deleteChat, listChats, loadChat, saveChat } from './services/chatStore'
import type { GithubRepo } from './services/chatStore'
import type { ChatSummary } from './services/chatStore'
import { useEscapeKey } from './hooks/useEscapeKey'
import Header from './components/Header'  // 상단 헤더 (로고, 설정, API 키)
import ChatPanel from './components/ChatPanel'  // 좌측 채팅 패널
import PreviewPanel from './components/PreviewPanel'  // 우측 코드 미리보기 패널
import type { PanelTab } from './components/PreviewPanel'
// AI 서비스 함수들 (스트리밍, 파싱, 모델 정보)
import { streamCode, parseVibe, MODELS } from './services/ai'
import type { Message, MessageImage, TokenUsage } from './services/ai'
import { addUsage, estimateCost, loadUsage, resetUsage } from './services/usage'

/**
 * HTML 마크업 판별 함수
 * AI 응답이 HTML 구조를 포함하는지 정규식으로 확인
 * 주요 HTML 태그의 존재 여부로 판단
 */
function isLikelyMarkup(text: string): boolean {
  return /<!doctype|<html|<body|<main|<div|<section|<script|<style/i.test(text)
}

/**
 * 생성된 프로젝트 유효성 검증 함수
 * 프로젝트 타입별 필수 파일이 모두 존재하는지 확인
 * - HTML: index.html + HTML 마크업 구조
 * - React: package.json + src/main.jsx(tsx) + src/App.jsx(tsx)
 * - Vue: package.json + src/main.js(ts) + src/App.vue
 */
type ProjectType = 'html' | 'react' | 'vue'

// 리파인 응답은 바뀐 파일만 담을 수 있으므로, 같은 종류의 프로젝트면 요청 직전 파일 위에 합친다. 종류가 바뀌면 응답 파일로 교체한다.
function mergeFiles(base: { files: Record<string, string>; type: ProjectType }, files: Record<string, string>, type: ProjectType) {
  return type === base.type ? { ...base.files, ...files } : files
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

/**
 * 파일 세트의 핑거프린트(지문) 생성 함수
 * 파일 이름과 크기로 고유한 문자열을 생성하여
 * 실시간 패치 시 파일 변경 여부를 빠르게 감지
 * 예: \"index.html:2048|style.css:512|app.js:1024\"
 */
function fingerprintFiles(files: Record<string, string>): string {
  const names = Object.keys(files).sort()
  return names.map((name) => `${name}:${files[name]?.length ?? 0}`).join('|')
}

/**
 * 상수: 실시간 패치 업데이트 쓰로틀 시간
 * 스트리밍 중 150ms 이상 간격으로만 Preview 업데이트
 * 과도한 리렌더링 방지를 위한 성능 최적화
 */
const REALTIME_PATCH_THROTTLE_MS = 150

// 이미지만 보내고 글을 비웠을 때 대신 보내는 요청
const IMAGE_ONLY_PROMPT = '이 이미지를 설명해 주세요'

// 파일 편집처럼 연속으로 바뀌는 변경을 한 번에 저장하기 위한 대기 시간
const SAVE_DELAY_MS = 500

// index.css 의 모바일 미디어 쿼리(max-width: 767px)와 같은 경계를 쓴다.
const MOBILE_QUERY = '(max-width: 767px)'

// 채팅 패널 너비 범위: 최소 200px, 최대 화면 너비의 60%. 키보드 조절은 한 번에 20px.
const CHAT_MIN_WIDTH = 200
const CHAT_KEY_STEP = 20
function clampChatWidth(width: number): number {
  return Math.max(CHAT_MIN_WIDTH, Math.min(width, window.innerWidth * 0.6))
}

/**
 * App 컴포넌트
 * 전체 애플리케이션의 메인 컴포넌트
 */
export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({})
  const projectFilesRef = useRef<Record<string, string>>({})
  const [projectType, setProjectType] = useState<'html' | 'react' | 'vue'>('html')
  const [githubRepo, setGithubRepo] = useState<GithubRepo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null)
  const [lastCost, setLastCost] = useState(0)
  const [usageTotals, setUsageTotals] = useState(loadUsage)
  // 요청 1건이 끝날 때마다 호출된다. 화면의 '이번' 값을 바꾸고 오늘·누적 합계에 더한다.
  const recordUsage = (usage: TokenUsage) => {
    setTokenUsage(usage)
    setLastCost(estimateCost(activeModel, usage))
    setUsageTotals(addUsage(activeModel, usage))
  }
  // 오른쪽 패널 '답변' 탭에 띄울 메시지 위치와, 패널 탭 전환 요청
  const [answerIndex, setAnswerIndex] = useState<number | null>(null)
  const [panelFocus, setPanelFocus] = useState<{ tab: PanelTab; seq: number }>({ tab: 'preview', seq: 0 })
  const focusPanel = (tab: PanelTab) => setPanelFocus((prev) => ({ tab, seq: prev.seq + 1 }))
  const envKey = (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined)?.trim() || ''
  const [activeApiKey, setActiveApiKey] = useState(() => envKey || localStorage.getItem('vibe_api_key_anthropic') || '')
  // 저장된 모델이 현재 MODELS 에 없으면(이전 버전의 값 등) 기본 모델로 되돌린다.
  const [activeModel, setActiveModel] = useState(() => {
    const saved = localStorage.getItem('vibe_model')
    return saved && MODELS.some((m) => m.id === saved) ? saved : MODELS[0].id
  })
  const bufferRef = useRef('')
  // 진행 중인 생성 요청. 중지 버튼이 abort() 한다.
  const abortRef = useRef<AbortController | null>(null)
  // 진행 중인 요청 직전의 프로젝트. 응답 파일을 이 위에 합친다.
  const baseProjectRef = useRef<{ files: Record<string, string>; type: ProjectType }>({ files: {}, type: 'html' })
  const lastRealtimePatchRef = useRef('')
  const lastRealtimePatchAtRef = useRef(0)
  const realtimePatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRealtimePatchRef = useRef<{
    files: Record<string, string>
    projectType: 'html' | 'react' | 'vue'
    fingerprint: string
  } | null>(null)

  // Resizable chat panel state
  // 드래그 가능한 패널 리사이저 상태
  // chatWidth: 채팅 패널의 현재 너비(px)
  // isDragging: 드래그 중 여부 플래그
  // startX: 드래그 시작 시 마우스 X 좌표
  // startWidth: 드래그 시작 시 초기 패널 너비
  const [chatWidth, setChatWidth] = useState(440)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  // 모바일에서는 채팅/미리보기를 탭으로 하나씩 보여준다.
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview'>('chat')
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // 테마: 저장된 선택이 있으면 그것을, 없으면 OS 설정을 따른다. <html data-theme> 으로 index.css 토큰이 바뀐다.
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('vibe_theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  // 첫 화면이 잘못된 테마로 깜빡이지 않도록 그리기 전에 적용한다.
  useLayoutEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('vibe_theme', next)
  }

  // 대화 목록: 데스크톱은 펼친 상태가 기본이고 접은 상태를 기억한다. 모바일은 닫힌 서랍으로 시작한다.
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    !window.matchMedia(MOBILE_QUERY).matches && localStorage.getItem('vibe_sidebar') !== 'closed')
  const toggleSidebar = () => {
    if (!isMobile) localStorage.setItem('vibe_sidebar', sidebarOpen ? 'closed' : 'open')
    setSidebarOpen(!sidebarOpen)
  }
  useEscapeKey(() => setSidebarOpen(false), isMobile && sidebarOpen)

  // 저장된 대화. chatId 가 null 이면 아직 저장 전인 새 대화다.
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [chatId, setChatId] = useState<string | null>(null)
  const chatCreatedAtRef = useRef(0)
  // 사용자가 보낸 요청이나 파일 수정으로 바뀐 내용이 있을 때만 저장한다. 대화를 불러온 직후에는 저장하지 않는다.
  const unsavedRef = useRef(false)
  const [storageError, setStorageError] = useState('')
  // 대화를 바꿀 때 PreviewPanel 을 새로 마운트해 배포 상태 등 내부 상태를 비운다(예전 새로고침과 같은 효과).
  const [sessionKey, setSessionKey] = useState(0)

  useEffect(() => {
    listChats().then(setChats).catch(() => setStorageError('대화 목록을 불러오지 못했습니다'))
  }, [])

  // 응답이 끝났거나 코드 탭에서 파일을 고친 뒤 SAVE_DELAY_MS 동안 변화가 없으면 저장한다. 생성 중에는 저장하지 않는다.
  useEffect(() => {
    if (!chatId || isLoading || messages.length === 0 || !unsavedRef.current) return
    const timer = setTimeout(() => {
      const chat = {
        id: chatId,
        title: chatTitle(messages),
        createdAt: chatCreatedAtRef.current,
        updatedAt: Date.now(),
        messages,
        projectFiles,
        projectType,
        githubRepo,
      }
      saveChat(chat)
        .then(() => {
          unsavedRef.current = false
          setStorageError('')
          setChats((prev) => [{ id: chat.id, title: chat.title, updatedAt: chat.updatedAt }, ...prev.filter((c) => c.id !== chat.id)])
        })
        .catch(() => setStorageError('대화를 저장하지 못했습니다 (저장 공간 부족 또는 시크릿 창)'))
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [chatId, isLoading, messages, projectFiles, projectType, githubRepo])

  // 생성 중 응답은 이 페이지가 직접 받고 있어서 새로고침·탭 닫기 시 끊기고 저장되지 않는다. 떠나기 전에 브라우저 확인창을 띄운다.
  useEffect(() => {
    if (!isLoading) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isLoading])

  /**
   * 드래그 시작 핸들러
   * 마우스 클릭 시 드래그 초기 상태 저장
   * 커서를 col-resize로 변경하고 텍스트 선택 방지
   */
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = chatWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [chatWidth])

  /**
   * 마우스 이동 핸들러
   * 드래그 중일 때만 활성화되어 패널 너비를 실시간으로 계산 및 업데이트
   * 최소 200px 이상, 최대 화면 너비 60% 범위로 제한
   */
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const delta = e.clientX - startX.current
    setChatWidth(clampChatWidth(startWidth.current + delta))
  }, [])

  // 드래그 대신 손잡이에 포커스를 두고 ←/→ 로 너비를 조절한다.
  const onResizerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const step = e.key === 'ArrowLeft' ? -CHAT_KEY_STEP : CHAT_KEY_STEP
    setChatWidth((w) => clampChatWidth(w + step))
  }

  /**
   * 마우스 릴리즈 핸들러
   * 드래그 종료 시 드래그 상태 해제 및 커서/텍스트 선택 복원
   */
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
    const merged = mergeFiles(baseProjectRef.current, files, pType)
    projectFilesRef.current = merged
    setProjectFiles(merged)
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
  const handleApiKeyChange = (key: string) => {
    setActiveApiKey(key)
    localStorage.setItem('vibe_api_key_anthropic', key)
  }

  const handleModelChange = (nextModel: string) => {
    setActiveModel(nextModel)
    localStorage.setItem('vibe_model', nextModel)
  }
  /**
   * AI 코드 생성 메인 로직
   * 
   * 처리 흐름:
   * 1. 유효성 검증 (API 키 존재, 로딩 중 아님, 레이트 리미트 확인)
   * 2. 사용자 메시지를 채팅 히스토리에 추가
   * 3. streamCode() async generator로 AI 스트리밍 시작
   * 4. 스트리밍 청크를 parseVibe()로 파싱하여 파일과 설명 추출
   * 5. 실시간 패치 적용 (150ms 쓰로틀)
   *    - 스트리밍 중 코드를 PreviewPanel에 즉시 반영
   *    - 과도한 렌더링 방지를 위해 쓰로틀링 적용
   * 6. 최종 코드와 설명을 메시지에 저장
   * 7. 형식 오류 처리 (자동 재생성)
   *    - <VIBE_FILE>, <VIBE_TYPE>, <VIBE_EXPLANATION> 형식 검증
   *    - 필수 파일 부족 시 AI에 재생성 요청
   * 8. 에러 처리
   *    - 에러 메시지를 채팅에 표시 (429·5xx 는 SDK 가 기본 2회 재시도한 뒤 도달)
   */
  const handleSend = async (prompt: string, images: MessageImage[] = []) => {
    if (!activeApiKey || isLoading) return
    // 이미지만 보내고 글을 비우면 기본 요청을 넣는다. API 는 빈 텍스트 블록을 받지 않는다.
    const userMsg: Message = {
      role: 'user',
      content: prompt || IMAGE_ONLY_PROMPT,
      ...(images.length > 0 ? { images } : {}),
    }
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
    // 새 대화의 첫 요청이면 이때 저장용 id 를 만든다. 응답이 끝나면 저장 effect 가 저장한다.
    if (!chatId) {
      setChatId(crypto.randomUUID())
      chatCreatedAtRef.current = Date.now()
    }
    unsavedRef.current = true
    // 중지하면 스트리밍 중 반영된 일부 파일 대신 이 상태로 되돌린다.
    const prevFiles = projectFilesRef.current
    const prevType = projectType
    baseProjectRef.current = { files: prevFiles, type: prevType }
    const controller = new AbortController()
    abortRef.current = controller
    let panelFocused = false
    try {
      for await (const chunk of streamCode(activeApiKey, activeModel, history, Object.keys(projectFiles).length ? projectFiles : undefined, recordUsage, controller.signal)) {
        bufferRef.current += chunk
        // 응답 첫 글자로 패널 탭을 고른다: 코드 생성 응답은 <VIBE_FILE> 로 시작하므로 미리보기, 그 외는 답변.
        // shortcut: 모델이 태그 앞에 설명을 먼저 쓰면 답변 탭이 열린다. 오분류가 잦으면 '<VIBE_' 등장 시 미리보기로 재전환한다.
        if (!panelFocused && bufferRef.current.trim()) {
          panelFocused = true
          const isCode = bufferRef.current.trim().startsWith('<')
          focusPanel(isCode ? 'preview' : 'answer')
          // 코드 생성 응답은 설명이 끝에 오므로, 끝날 때까지 답변 탭에 이전 답변을 남겨 둔다.
          if (!isCode) setAnswerIndex(history.length)
        }
        const parsedChunk = parseVibe(bufferRef.current)
        const { explanation } = parsedChunk

        // Real-time patch: update code preview while streaming
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
          // VIBE 태그가 없으면 일반 대화 답변이므로 받은 텍스트를 그대로 보여준다.
          updated[updated.length - 1] = {
            role: 'assistant',
            content: explanation || (bufferRef.current.includes('<VIBE_') ? '생성 중...' : bufferRef.current),
            files: {},
          }
          return updated
        })
      }

      flushPendingRealtimePatch()

      let parsed = parseVibe(bufferRef.current)

        // Auto-repair response format if model didn't generate valid code structure
      // 코드를 만들려다(<VIBE_FILE> 존재) 구조가 깨진 경우에만 보정한다. 태그가 없으면 일반 대화 답변이다.
      if (bufferRef.current.includes('<VIBE_FILE') && !isValidGeneratedProject(mergeFiles(baseProjectRef.current, parsed.files, parsed.projectType), parsed.projectType)) {
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
          activeApiKey,
          activeModel,
          [{ role: 'user', content: repairPrompt }],
          Object.keys(projectFiles).length ? projectFiles : undefined,
          recordUsage,
          controller.signal,
        )) {
          repairedRaw += chunk
        }

        const repaired = parseVibe(repairedRaw)
        if (isValidGeneratedProject(mergeFiles(baseProjectRef.current, repaired.files, repaired.projectType), repaired.projectType)) {
          parsed = repaired
          bufferRef.current = repairedRaw
        }
      }

      const { files, explanation, projectType: pType } = parsed
      if (Object.keys(files).length > 0) {
        const merged = mergeFiles(baseProjectRef.current, files, pType)
        projectFilesRef.current = merged
        setProjectFiles(merged)
        setProjectType(pType)
      }
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: explanation || (bufferRef.current.includes('<VIBE_')
            ? '완성됐습니다! 코드 탭에서 소스를 확인할 수 있어요.'
            : bufferRef.current.trim()),
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
      if (controller.signal.aborted) {
        projectFilesRef.current = prevFiles
        setProjectFiles(prevFiles)
        setProjectType(prevType)
        const { explanation } = parseVibe(bufferRef.current)
        const partial = explanation || (bufferRef.current.includes('<VIBE_') ? '' : bufferRef.current.trim())
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: `${partial ? `${partial}\n\n` : ''}(생성을 중지했습니다)`, files: {} }
          return updated
        })
        return
      }
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다'
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: `오류: ${message}`, files: {} }
        return updated
      })
    } finally {
      pendingRealtimePatchRef.current = null
      if (realtimePatchTimerRef.current) {
        clearTimeout(realtimePatchTimerRef.current)
        realtimePatchTimerRef.current = null
      }
      abortRef.current = null
      // 완료·오류·중지 모두 이 응답을 답변 탭에 연다.
      setAnswerIndex(history.length)
      setIsLoading(false)
    }
  }

  const handleStop = () => abortRef.current?.abort()

  /**
   * 프로젝트 가져오기 핸들러
   * GitHub에서 가져온 프로젝트를 UI에 로드
   */
  const handleImportProject = (importedFiles: Record<string, string>, importedType: 'html' | 'react' | 'vue') => {
    projectFilesRef.current = importedFiles
    setProjectFiles(importedFiles)
    setProjectType(importedType)
    unsavedRef.current = true
  }

  const handleGithubRepoChange = (repo: GithubRepo) => {
    setGithubRepo(repo)
    unsavedRef.current = true
  }

  // 화면을 빈 대화 상태로 되돌린다. 저장소는 건드리지 않는다.
  const resetConversation = () => {
    setMessages([])
    projectFilesRef.current = {}
    setProjectFiles({})
    setProjectType('html')
    setGithubRepo(null)
    setAnswerIndex(null)
    setTokenUsage(null)
    setLastCost(0)
    setSessionKey((k) => k + 1)
    unsavedRef.current = false
  }

  // 생성 중에는 전환하지 않는다. 진행 중인 응답이 다른 대화에 섞이지 않게 하기 위함이다.
  const handleNewChat = () => {
    if (isLoading) return
    resetConversation()
    setChatId(null)
    setMobileTab('chat')
    if (isMobile) setSidebarOpen(false)
  }

  const handleSelectChat = async (id: string) => {
    if (isLoading || id === chatId) return
    try {
      const chat = await loadChat(id)
      if (!chat) {
        setChats((prev) => prev.filter((c) => c.id !== id))
        setStorageError('대화를 찾을 수 없습니다')
        return
      }
      resetConversation()
      setChatId(chat.id)
      chatCreatedAtRef.current = chat.createdAt
      setMessages(chat.messages)
      projectFilesRef.current = chat.projectFiles
      setProjectFiles(chat.projectFiles)
      setProjectType(chat.projectType)
      setGithubRepo(chat.githubRepo ?? null)
      const lastAnswer = chat.messages.map((m) => m.role).lastIndexOf('assistant')
      setAnswerIndex(lastAnswer >= 0 ? lastAnswer : null)
      focusPanel(Object.keys(chat.projectFiles).length > 0 ? 'preview' : 'answer')
      setMobileTab('chat')
      if (isMobile) setSidebarOpen(false)
    } catch {
      setStorageError('대화를 불러오지 못했습니다')
    }
  }

  const handleDeleteChat = async (id: string) => {
    if (isLoading) return
    const title = chats.find((c) => c.id === id)?.title ?? '이 대화'
    if (!window.confirm(`'${title}' 대화를 삭제할까요? 되돌릴 수 없습니다.`)) return
    try {
      await deleteChat(id)
      setChats((prev) => prev.filter((c) => c.id !== id))
      if (id === chatId) handleNewChat()
    } catch {
      setStorageError('대화를 삭제하지 못했습니다')
    }
  }

  // 대화의 답변 카드를 누르면 그 답변을 패널에 연다. 모바일은 패널 탭으로 넘어간다.
  const handleOpenAnswer = (index: number) => {
    setAnswerIndex(index)
    focusPanel('answer')
    setMobileTab('preview')
  }

  const handleFilesChange = (nextFiles: Record<string, string>) => {
    projectFilesRef.current = nextFiles
    setProjectFiles(nextFiles)
    unsavedRef.current = true
  }

  const sidebar = (
    <Sidebar
      chats={chats}
      activeId={chatId}
      busy={isLoading}
      error={storageError}
      onSelect={handleSelectChat}
      onNew={handleNewChat}
      onDelete={handleDeleteChat}
      onClose={toggleSidebar}
    />
  )

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <Header
        apiKey={activeApiKey}
        model={activeModel}
        onApiKeyChange={handleApiKeyChange}
        onModelChange={handleModelChange}
        isEnvKey={Boolean(envKey)}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      {/* 모바일: 대화 목록을 화면 왼쪽 서랍으로 띄운다. 바깥을 누르거나 Esc 로 닫는다. */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-40 flex" style={{ background: 'rgba(20,20,19,0.4)' }}
          onClick={(e) => e.target === e.currentTarget && setSidebarOpen(false)}>
          <div className="h-full" style={{ boxShadow: '4px 0 16px rgba(0,0,0,0.2)' }}>{sidebar}</div>
        </div>
      )}
      {isMobile && (
        <div role="tablist" className="flex flex-shrink-0" style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)' }}>
          {(['chat', 'preview'] as const).map((tab) => (
            <button key={tab} role="tab" aria-selected={mobileTab === tab} onClick={() => setMobileTab(tab)}
              className="flex-1"
              style={{
                height: 44,
                fontFamily: 'var(--ui-font)',
                fontSize: 'var(--fs-sm)',
                background: 'transparent',
                border: 'none',
                borderBottom: mobileTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                color: mobileTab === tab ? 'var(--txt)' : 'var(--txt-2)',
                cursor: 'pointer',
              }}>
              {tab === 'chat' ? 'Chat' : 'Preview'}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        {/* 데스크톱: 접으면 펼치기 버튼만 담은 레일을 남긴다. */}
        {!isMobile && (sidebarOpen
          ? <div className="flex-shrink-0">{sidebar}</div>
          : <div className="sidebar-rail">
              <button onClick={toggleSidebar} className="icon-btn" aria-label="대화 목록 펼치기" aria-expanded={false}>
                <PanelLeft style={{ width: 18, height: 18 }} />
              </button>
            </div>)}
        {/* 모바일에서도 두 패널을 모두 마운트해 둔다. 탭 전환으로 입력 중인 내용·배포 상태가 사라지지 않게 하기 위함이다. */}
        <div className={`flex min-w-0 ${isMobile ? 'flex-1' : ''} ${isMobile && mobileTab !== 'chat' ? 'hidden' : ''}`}>
          <ChatPanel
            messages={messages}
            onSend={handleSend}
            onStop={handleStop}
            isLoading={isLoading}
            hasApiKey={!!activeApiKey}
            width={isMobile ? undefined : chatWidth}
            tokenUsage={tokenUsage}
            lastCost={lastCost}
            usageTotals={usageTotals}
            onResetUsage={() => setUsageTotals(resetUsage())}
            activeAnswerIndex={answerIndex}
            onOpenAnswer={handleOpenAnswer}
            onNewChat={handleNewChat}
          />
        </div>
        {/* Drag handle */}
        {!isMobile && <div
          onMouseDown={onMouseDown}
          onKeyDown={onResizerKeyDown}
          tabIndex={0}
          role="separator"
          aria-orientation="vertical"
          aria-label="채팅 패널 너비 조절 (←/→)"
          aria-valuenow={Math.round(chatWidth)}
          aria-valuemin={CHAT_MIN_WIDTH}
          style={{
            width: 1,
            flexShrink: 0,
            background: 'var(--border)',
            cursor: 'col-resize',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
          onMouseLeave={e => { if (!isDragging.current) e.currentTarget.style.background = 'var(--border)' }}
        />}
        {/* Code preview panel */}
        <div className={`flex flex-1 min-w-0 ${isMobile && mobileTab !== 'preview' ? 'hidden' : ''}`}>
          <PreviewPanel
            key={sessionKey}
            files={projectFiles}
            projectType={projectType}
            isLoading={isLoading}
            onImport={handleImportProject}
            onFilesChange={handleFilesChange}
            githubRepo={githubRepo}
            onGithubRepoChange={handleGithubRepoChange}
            answer={answerIndex !== null ? messages[answerIndex] ?? null : null}
            focus={panelFocus}
          />
        </div>
      </div>
    </div>
  )
}
