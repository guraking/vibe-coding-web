import { useState, useRef, useEffect, useMemo } from 'react'
import { Eye, Code2, Copy, Check, ExternalLink, FileCode2, RefreshCw, FileText, FileJson, Palette, GitFork, FolderGit2, KeyRound, History } from 'lucide-react'
import ExportModal from './ExportModal'
import ImportModal from './ImportModal'
import { fetchDeploymentUrl, deployToGitHubPages } from '../services/github'

/**
 * PreviewPanel 컴포넌트: 우측 코드/미리보기 패널
 * 
 * 주요 기능:
 * - 두 개 탭: Preview (미리보기), Code (코드 보기)
 * - HTML: 로컬 blob URL로 즉시 렌더링
 * - React/Vue: GitHub Pages 배포 후 배포 URL로 렌더링
 * - 파일 트리 뷰 (좌측, 너비 조정 가능)
 * - 코드 하이라이팅 및 복사 기능\n * - GitHub 프로젝트 import/export\n * - GitHub Pages 자동 배포 및 배포 히스토리\n */
interface Props {
  files: Record<string, string>
  projectType: 'html' | 'react' | 'vue'
  isLoading: boolean
  onImport: (files: Record<string, string>, projectType: 'html' | 'react' | 'vue') => void
  onFilesChange: (files: Record<string, string>) => void
}

type GithubRepo = { owner: string; repo: string; branch: string }
type DeploymentHistoryItem = { owner: string; repo: string; branch: string; url: string; deployedAt: number }

type Tab = 'preview' | 'code'

const DEPLOY_HISTORY_KEY = 'vibe_deploy_history'
const GITHUB_REPO_KEY = 'vibe_github_repo'

function loadGithubRepo(): GithubRepo | null {
  try {
    const raw = localStorage.getItem(GITHUB_REPO_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GithubRepo
    if (!parsed?.owner || !parsed?.repo) return null
    return parsed
  } catch {
    return null
  }
}

function loadDeployHistory(): DeploymentHistoryItem[] {
  try {
    const raw = localStorage.getItem(DEPLOY_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as DeploymentHistoryItem[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => !!item && !!item.url && !!item.owner && !!item.repo)
      .sort((a, b) => b.deployedAt - a.deployedAt)
      .slice(0, 30)
  } catch {
    return []
  }
}

function saveDeployHistory(items: DeploymentHistoryItem[]): void {
  localStorage.setItem(DEPLOY_HISTORY_KEY, JSON.stringify(items.slice(0, 30)))
}

function upsertDeployHistory(items: DeploymentHistoryItem[], next: DeploymentHistoryItem): DeploymentHistoryItem[] {
  const filtered = items.filter((i) => !(i.owner === next.owner && i.repo === next.repo && i.url === next.url))
  return [next, ...filtered].sort((a, b) => b.deployedAt - a.deployedAt).slice(0, 30)
}

/** Inline CSS/JS into a single self-contained HTML for HTML projects */
// Bundle CSS and JS files into HTML for static HTML projects
function bundleFiles(files: Record<string, string>): string {
  let html = files['index.html'] || ''

  html = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+\.css)["'][^>]*\/?>/gi, (_m: string, href: string) => {
    const css = files[href.replace(/^\.\//, '')]
    return css ? `<style>\n${css}\n</style>` : _m
  })
  html = html.replace(/<link[^>]+href=["']([^"']+\.css)["'][^>]+rel=["']stylesheet["'][^>]*\/?>/gi, (_m: string, href: string) => {
    const css = files[href.replace(/^\.\//, '')]
    return css ? `<style>\n${css}\n</style>` : _m
  })
  html = html.replace(/<script([^>]*)src=["']([^"']+\.(js|mjs))["']([^>]*)><\/script>/gi, (_m: string, pre: string, src: string, _ext: string, post: string) => {
    const js = files[src.replace(/^\.\//, '')]
    return js ? `<script${pre}${post}>\n${js}\n</script>` : _m
  })

  if (!html.includes('cdn.tailwindcss.com')) {
    html = html.replace('</head>', '  <script src="https://cdn.tailwindcss.com"></script>\n</head>')
  }

  // bare module specifier가 있는 경우 importmap으로 CDN 주소 매핑 (브라우저 호환)
  const hasBareImport = /import\s+.*from\s+['"](?!https?:\/\/|\/|\.\/|\.\.\/)/.test(html)
  if (hasBareImport && !html.includes('<script type="importmap"')) {
    const importMap = JSON.stringify({
      imports: {
        'vue': 'https://unpkg.com/vue@3/dist/vue.esm-browser.js',
        'react': 'https://esm.sh/react@18',
        'react-dom': 'https://esm.sh/react-dom@18',
        'react-dom/client': 'https://esm.sh/react-dom@18/client',
        'react/jsx-runtime': 'https://esm.sh/react@18/jsx-runtime',
      }
    }, null, 2)
    html = html.replace('<head>', `<head>\n  <script type="importmap">\n  ${importMap}\n  </script>`)
  }

  return html
}

function fileIcon(name: string) {
  if (name.endsWith('.css')) return <Palette style={{ width: 12, height: 12, color: '#60a5fa' }} className="shrink-0" />
  if (name.endsWith('.json')) return <FileJson style={{ width: 12, height: 12, color: '#fbbf24' }} className="shrink-0" />
  if (name.endsWith('.vue')) return <FileCode2 style={{ width: 12, height: 12, color: '#42d392' }} className="shrink-0" />
  if (name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.jsx') || name.endsWith('.tsx'))
    return <FileText style={{ width: 12, height: 12, color: '#f59e0b' }} className="shrink-0" />
  return <FileCode2 style={{ width: 12, height: 12, color: 'var(--ok)' }} className="shrink-0" />
}

function PixelMiniBar() {
  return (
    <span className="inline-flex gap-0.5 ml-1" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <span
          key={i}
          className="pixel-loader-cell"
          style={{ width: 3, height: 3, animationDelay: `${i * 70}ms` }}
        />
      ))}
    </span>
  )
}

function PixelLoadingBar({
  size = 'md',
  label,
  subLabel,
}: {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  subLabel?: string
}) {
  const cells = size === 'sm' ? 10 : size === 'lg' ? 20 : 14
  const cellSize = size === 'sm' ? 4 : size === 'lg' ? 9 : 6
  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <p style={{ color: 'var(--txt)', fontFamily: 'var(--pixel-font)', fontSize: size === 'lg' ? 10 : 9 }}>
          {label}
        </p>
      )}
      <div
        className="flex items-center gap-1 px-2 py-1"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          boxShadow: '2px 2px 0 var(--border-s)',
        }}
      >
        {Array.from({ length: cells }).map((_, i) => (
          <span
            key={i}
            className="pixel-loader-cell"
            style={{
              width: cellSize,
              height: cellSize,
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>
      {subLabel && (
        <p style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
          {subLabel}
        </p>
      )}
    </div>
  )
}

export default function PreviewPanel({ files, projectType, isLoading, onImport, onFilesChange }: Props) {
  const [tab, setTab] = useState<Tab>('preview')
  const [selectedFile, setSelectedFile] = useState('index.html')
  const [copied, setCopied] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeKey, setIframeKey] = useState(0)
  const blobUrlRef = useRef<string>('')
  const isImportRef = useRef(false)
  const [showExport, setShowExport] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [githubRepo, setGithubRepo] = useState<GithubRepo | null>(() => loadGithubRepo())

  const setGithubRepoPersist = (repo: GithubRepo | null) => {
    setGithubRepo(repo)
    if (repo) localStorage.setItem(GITHUB_REPO_KEY, JSON.stringify(repo))
    else localStorage.removeItem(GITHUB_REPO_KEY)
  }
  const [deployUrl, setDeployUrl] = useState<string | null>(null)
  const [deployStatus, setDeployStatus] = useState('')
  const [deployError, setDeployError] = useState('')
  const [deployStep, setDeployStep] = useState<'idle' | 'checking' | 'deploying' | 'needs-token' | 'deploy-error' | 'deploy-done'>('idle')
  const [deployToken, setDeployToken] = useState(() => localStorage.getItem('vibe_gh_token') || '')
  const [deployUrlCopied, setDeployUrlCopied] = useState(false)
  const [deployHistory, setDeployHistory] = useState<DeploymentHistoryItem[]>(() => loadDeployHistory())
  const deployAbortRef = useRef(false)
  const deployTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // deployStep ref: useEffect가 deployStep 변경에 반응하지 않도록 ref로 읽음
  const deployStepRef = useRef(deployStep)
  useEffect(() => { deployStepRef.current = deployStep }, [deployStep])
  const [fileListWidth, setFileListWidth] = useState(220)
  const [saveLabel, setSaveLabel] = useState<'auto-save' | 'saved'>('auto-save')
  const saveBadgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const codeTabRef = useRef<HTMLDivElement>(null)
  const resizingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartWidthRef = useRef(220)

  const fileNames = Object.keys(files).sort((a, b) => {
    const order = ['index.html', 'package.json', 'vite.config.js']
    const ai = order.indexOf(a), bi = order.indexOf(b)
    if (ai >= 0 && bi < 0) return -1
    if (bi >= 0 && ai < 0) return 1
    const ext = (f: string) => f.split('.').pop() || ''
    const extOrder = ['html', 'json', 'js', 'jsx', 'tsx', 'ts', 'css']
    return (extOrder.indexOf(ext(a)) - extOrder.indexOf(ext(b))) || a.localeCompare(b)
  })

  const hasFiles = fileNames.length > 0

  // Blob URL for HTML projects
  const blobUrl = useMemo(() => {
    if (!hasFiles || !files['index.html'] || projectType === 'react' || projectType === 'vue') return ''
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    const url = URL.createObjectURL(new Blob([bundleFiles(files)], { type: 'text/html' }))
    blobUrlRef.current = url
    return url
  }, [files, projectType])

  const previewSrc = blobUrl || deployUrl || ''

  useEffect(() => {
    if (hasFiles) {
      if (isImportRef.current) {
        isImportRef.current = false
        setSelectedFile(fileNames[0] || 'index.html')
        return
      }
      // 새 파일 생성/업데이트 시 deployUrl 리셋 (배포중·완료 상태는 유지)
      // deployStepRef 사용: 이 effect가 deployStep 변경에 재실행되지 않도록
      const step = deployStepRef.current
      if (step !== 'deploying' && step !== 'deploy-done') {
        setDeployUrl(null)
      }
      setSelectedFile(fileNames[0] || 'index.html')
    }
  }, [files])

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      if (deployTimeoutRef.current) clearTimeout(deployTimeoutRef.current)
      if (saveBadgeTimerRef.current) clearTimeout(saveBadgeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return
      const containerWidth = codeTabRef.current?.clientWidth || 0
      const minWidth = 140
      const maxWidth = Math.max(minWidth, Math.floor(containerWidth * 0.6))
      const nextWidth = dragStartWidthRef.current + (e.clientX - dragStartXRef.current)
      setFileListWidth(Math.min(maxWidth, Math.max(minWidth, nextWidth)))
    }

    const onMouseUp = () => {
      if (!resizingRef.current) return
      resizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const startResizeFileList = (e: React.MouseEvent<HTMLDivElement>) => {
    resizingRef.current = true
    dragStartXRef.current = e.clientX
    dragStartWidthRef.current = fileListWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const selectedContent = files[selectedFile] || ''
  const totalLines = Object.values(files).reduce((s, c) => s + c.split('\n').length, 0)
  const selectedLineCount = Math.max(1, selectedContent.split('\n').length)
  const repoDeployHistory = useMemo(() => {
    if (!githubRepo) return []
    return deployHistory.filter((h) => h.owner === githubRepo.owner && h.repo === githubRepo.repo)
  }, [deployHistory, githubRepo])

  const persistDeployment = (owner: string, repo: string, branch: string, url: string) => {
    const next = upsertDeployHistory(deployHistory, {
      owner,
      repo,
      branch,
      url,
      deployedAt: Date.now(),
    })
    setDeployHistory(next)
    saveDeployHistory(next)
  }

  const formatHistoryTime = (ts: number) => {
    const d = new Date(ts)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${mm}/${dd} ${hh}:${mi}`
  }

  const copyFile = async () => {
    await navigator.clipboard.writeText(selectedContent)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const updateSelectedFileContent = (nextContent: string) => {
    if (!selectedFile) return
    const nextFiles = { ...files, [selectedFile]: nextContent }
    onFilesChange(nextFiles)
    setSaveLabel('saved')
    if (saveBadgeTimerRef.current) clearTimeout(saveBadgeTimerRef.current)
    saveBadgeTimerRef.current = setTimeout(() => setSaveLabel('auto-save'), 1500)
  }
  const copyDeployUrl = async () => {
    if (!deployUrl) return
    await navigator.clipboard.writeText(deployUrl)
    setDeployUrlCopied(true)
    setTimeout(() => setDeployUrlCopied(false), 2000)
  }
  const refresh = () => setIframeKey(k => k + 1)
  const openNew = () => {
    const target = blobUrl || deployUrl
    if (target) window.open(target, '_blank')
    else if (githubRepo) window.open(`https://github.com/${githubRepo.owner}/${githubRepo.repo}/deployments`, '_blank')
  }

  const handleExportSuccess = async (owner: string, repo: string, branch: string, token: string) => {
    setGithubRepoPersist({ owner, repo, branch })
    setDeployUrl(null)
    setDeployError('')
    setDeployStep('idle')
    setShowExport(false)
    setTab('preview')
    setIframeKey(k => k + 1)

    // React/Vue는 push 완료 직후 자동 배포 후 preview에 배포 URL 표시
    if (projectType === 'react' || projectType === 'vue') {
      await startDeploy(owner, repo, branch, token)
    }
  }

  const startDeploy = async (owner: string, repo: string, branch: string, token: string) => {
    localStorage.setItem('vibe_gh_token', token)
    setDeployToken(token)
    setDeployStep('deploying')
    setDeployError('')
    setDeployStatus('')
    deployAbortRef.current = false
    
    // 15분 안전 타임아웃 (배포가 무한 대기하는 것 방지)
    if (deployTimeoutRef.current) clearTimeout(deployTimeoutRef.current)
    deployTimeoutRef.current = setTimeout(() => {
      if (deployStep === 'deploying') {
        deployAbortRef.current = true
        setDeployError('배포 타임아웃 (15분). 배포 상태를 확인하거나 다시 시도하세요.')
        setDeployStatus('')
        setDeployStep('idle')
      }
    }, 15 * 60 * 1000)
    
    try {
      const url = await deployToGitHubPages(token, owner, repo, branch, setDeployStatus)
      if (!deployAbortRef.current) {
        if (deployTimeoutRef.current) clearTimeout(deployTimeoutRef.current)
        setDeployUrl(url)
        persistDeployment(owner, repo, branch, url)
        setDeployStatus('')
        setDeployStep('deploy-done')  // 배포 완료 → 미리보기 버튼 표시
      }
    } catch (err) {
      if (!deployAbortRef.current) {
        if (deployTimeoutRef.current) clearTimeout(deployTimeoutRef.current)
        setDeployError(err instanceof Error ? err.message : '배포 실패')
        setDeployStatus('')
        setDeployStep('deploy-error')
      }
    }
  }
  
  const cancelDeploy = () => {
    deployAbortRef.current = true
    if (deployTimeoutRef.current) clearTimeout(deployTimeoutRef.current)
    setDeployStep('idle')
    setDeployStatus('')
    setDeployError('배포가 취소되었습니다.')
  }

  const openPreviewFromDeploy = () => {
    // 배포 완료 화면 → iframe 미리보기로 전환
    setDeployStep('idle')
    setTab('preview')
    setIframeKey(k => k + 1)
  }

  const handleImportSuccess = async (importedFiles: Record<string, string>, importedType: 'html' | 'react' | 'vue', owner: string, repo: string, branch: string) => {
    isImportRef.current = true
    setShowImport(false)
    setGithubRepoPersist({ owner, repo, branch })
    setDeployUrl(null)
    setDeployError('')
    setDeployStep('idle')
    onImport(importedFiles, importedType)
    setTab('preview')
    setIframeKey(k => k + 1)
    // HTML은 blob으로 바로 표시되므로 배포 URL 불필요
    if (importedType === 'react' || importedType === 'vue') {
      setDeployStep('checking')
      const token = localStorage.getItem('vibe_gh_token') || ''
      const url = await fetchDeploymentUrl(owner, repo, token || undefined)
      if (url) {
        setDeployUrl(url)
        persistDeployment(owner, repo, branch, url)
        setDeployStep('idle')
        setIframeKey(k => k + 1)
      } else if (token) {
        // 자동 배포 시작
        await startDeploy(owner, repo, branch, token)
      } else {
        // 토큰 없음 — 입력 요청
        setDeployStep('needs-token')
      }
    }
  }

  const TabBtn = ({ id, icon: Icon, label }: { id: Tab; icon: React.ElementType; label: string }) => (
    <button onClick={() => setTab(id)}
      className="flex items-center gap-1.5 transition-all"
      style={{
        height: 36,
        padding: '0 12px',
        fontFamily: 'var(--mono-font)',
        fontSize: 11,
        background: 'transparent',
        border: 'none',
        borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
        color: tab === id ? 'var(--txt)' : 'var(--txt-2)',
        cursor: 'pointer',
      }}
      onMouseEnter={e => { if (tab !== id) e.currentTarget.style.color = 'var(--txt)' }}
      onMouseLeave={e => { if (tab !== id) e.currentTarget.style.color = 'var(--txt-2)' }}>
      <Icon style={{ width: 12, height: 12 }} />
      <span>{label}</span>
      {id === 'preview' && isLoading && (
        <PixelMiniBar />
      )}
    </button>
  )

  return (
    <div className="flex flex-col flex-1 min-w-0" style={{ background: 'var(--bg)' }}>
      {/* Tab bar */}
      <div className="flex items-center flex-shrink-0"
        style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', height: 36 }}>
        <TabBtn id="preview" icon={Eye} label="preview" />
        <TabBtn id="code" icon={Code2} label={`code${hasFiles ? ` [${fileNames.length}]` : ''}`} />
        <div className="flex-1" />

        {isLoading && (
          <div className="flex items-center gap-1.5 mr-2"
            style={{ color: 'var(--accent)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
            <PixelMiniBar />
            generating...
          </div>
        )}

        {/* GitHub import button */}
        <button onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 transition-all"
          style={{ color: 'var(--txt-2)', fontFamily: 'var(--mono-font)', fontSize: 10, padding: '2px 10px', background: 'none', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--txt)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt-2)'; e.currentTarget.style.background = 'none' }}
          title="Import from GitHub">
          <FolderGit2 style={{ width: 12, height: 12 }} />
          <span>import</span>
        </button>

        {/* GitHub export button */}
        {hasFiles && (
          <button onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 transition-all"
            style={githubRepo
              ? { color: 'var(--ok)', background: 'var(--ok-bg)', fontFamily: 'var(--mono-font)', fontSize: 10, padding: '2px 10px', border: '1px solid var(--ok-bd)', cursor: 'pointer' }
              : { color: 'var(--txt-2)', fontFamily: 'var(--mono-font)', fontSize: 10, padding: '2px 10px', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => { if (!githubRepo) { e.currentTarget.style.color = 'var(--txt)'; e.currentTarget.style.background = 'var(--bg-hover)' } }}
            onMouseLeave={e => { if (!githubRepo) { e.currentTarget.style.color = 'var(--txt-2)'; e.currentTarget.style.background = 'none' } }}
            title="Export to GitHub">
            <GitFork style={{ width: 12, height: 12 }} />
            <span>{githubRepo ? `${githubRepo.owner}/${githubRepo.repo}` : 'github'}</span>
          </button>
        )}

        {previewSrc && tab === 'preview' && (
          <>
            {deployUrl && repoDeployHistory.length > 0 && (
              <div className="flex items-center gap-1 px-2" style={{ borderLeft: '1px solid var(--border-s)', borderRight: '1px solid var(--border-s)', marginRight: 4 }}>
                <History style={{ width: 11, height: 11, color: 'var(--txt-3)' }} />
                <select
                  value={deployUrl}
                  onChange={e => { setDeployUrl(e.target.value); setIframeKey(k => k + 1) }}
                  className="appearance-none bg-transparent focus:outline-none"
                  style={{ color: 'var(--txt-2)', fontFamily: 'var(--mono-font)', fontSize: 10, height: 28, maxWidth: '100%' }}
                  title="Deployment URL history"
                >
                  {repoDeployHistory.map((item) => (
                    <option key={`${item.url}_${item.deployedAt}`} value={item.url}>
                      {formatHistoryTime(item.deployedAt)} · {item.url}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button onClick={refresh}
              className="flex items-center justify-center transition-all"
              style={{ width: 32, height: 32, color: 'var(--txt-3)', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--txt-2)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt-3)'; e.currentTarget.style.background = 'transparent' }}
              title="Refresh">
              <RefreshCw style={{ width: 12, height: 12 }} />
            </button>
            {deployUrl && (
              <button onClick={copyDeployUrl}
                className="flex items-center gap-1.5 transition-all"
                style={deployUrlCopied
                  ? { color: 'var(--ok)', background: 'var(--ok-bg)', fontFamily: 'var(--mono-font)', fontSize: 10, padding: '2px 10px', border: 'none', cursor: 'pointer' }
                  : { color: 'var(--txt-2)', fontFamily: 'var(--mono-font)', fontSize: 10, padding: '2px 10px', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { if (!deployUrlCopied) { e.currentTarget.style.color = 'var(--txt)'; e.currentTarget.style.background = 'var(--bg-hover)' } }}
                onMouseLeave={e => { if (!deployUrlCopied) { e.currentTarget.style.color = 'var(--txt-2)'; e.currentTarget.style.background = 'transparent' } }}
                title="Copy deployment URL">
                {deployUrlCopied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                <span>{deployUrlCopied ? 'url copied!' : 'copy url'}</span>
              </button>
            )}
            <button onClick={openNew}
              className="flex items-center gap-1.5 transition-all"
              style={{ color: 'var(--txt-2)', fontFamily: 'var(--mono-font)', fontSize: 10, padding: '2px 10px', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--txt)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt-2)'; e.currentTarget.style.background = 'transparent' }}>
              <ExternalLink style={{ width: 12, height: 12 }} /><span>open</span>
            </button>
          </>
        )}
        {hasFiles && tab === 'code' && (
          <button onClick={copyFile}
            className="flex items-center gap-1.5 transition-all"
            style={copied
              ? { color: 'var(--ok)', background: 'var(--ok-bg)', fontFamily: 'var(--mono-font)', fontSize: 10, padding: '2px 10px', border: 'none', cursor: 'pointer' }
              : { color: 'var(--txt-2)', fontFamily: 'var(--mono-font)', fontSize: 10, padding: '2px 10px', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => { if (!copied) { e.currentTarget.style.color = 'var(--txt)'; e.currentTarget.style.background = 'var(--bg-hover)' } }}
            onMouseLeave={e => { if (!copied) { e.currentTarget.style.color = 'var(--txt-2)'; e.currentTarget.style.background = 'transparent' } }}>
            {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
            <span>{copied ? 'copied!' : 'copy'}</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Preview tab */}
        <div className={`absolute inset-0 ${tab === 'preview' ? 'flex' : 'hidden'} flex-col`}>
          {isLoading && !previewSrc ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-7" style={{ background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
              <div
                className="pixel-panel"
                style={{
                  padding: '18px 22px',
                  border: '2px solid var(--accent-bd)',
                  boxShadow: '4px 4px 0 rgba(0,0,0,0.12)',
                  background: 'linear-gradient(180deg, var(--bg-panel), #eceff4)',
                }}
              >
                <div className="text-center" style={{ marginBottom: 14 }}>
                  <p style={{ color: 'var(--txt)', fontFamily: 'var(--pixel-font)', fontSize: 12, marginBottom: 7 }}>
                    AI GENERATING
                  </p>
                  <p style={{ color: 'var(--accent)', fontFamily: 'var(--mono-font)', fontSize: 11 }}>
                    BUILDING PIXEL MAGIC...
                  </p>
                </div>
                <PixelLoadingBar size="lg" />
              </div>
              <p style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
                파일과 컴포넌트를 조립 중입니다
              </p>
            </div>
          ) : previewSrc ? (
            <iframe key={iframeKey} ref={iframeRef} src={previewSrc}
              className="w-full h-full border-0" allow="fullscreen" title="Preview" />
          ) : deployStep === 'checking' ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <PixelLoadingBar size="md" label="DEPLOY LOOKUP" subLabel="기존 배포 URL 확인 중..." />
            </div>
          ) : deployStep === 'deploying' ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <PixelLoadingBar size="lg" label="DEPLOYING" subLabel={deployStatus || '준비 중...'} />
              <div className="text-center flex flex-col gap-1.5">
                <p style={{ color: 'var(--txt)', fontFamily: 'var(--mono-font)', fontSize: 12 }}>
                  GitHub Pages 배포 중
                </p>
              </div>
              {githubRepo && (
                <a
                  href={`https://github.com/${githubRepo.owner}/${githubRepo.repo}/actions`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-1"
                  style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10 }}
                >
                  <ExternalLink style={{ width: 10, height: 10 }} /> Actions 로그 보기
                </a>
              )}
              <button
                onClick={cancelDeploy}
                className="flex items-center gap-1.5 transition-all"
                style={{ color: 'var(--txt-2)', fontFamily: 'var(--mono-font)', fontSize: 10, padding: '6px 12px', background: 'var(--bg-panel)', border: '1px solid var(--border)', cursor: 'pointer' }}
              >
                배포 취소
              </button>
            </div>
          ) : deployStep === 'deploy-error' ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div style={{
                width: 56, height: 56,
                background: 'var(--err-bg)',
                border: '1px solid var(--err-bd)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ExternalLink style={{ width: 24, height: 24, color: 'var(--err)' }} />
              </div>
              <div className="text-center">
                <p style={{ color: 'var(--txt)', fontFamily: 'var(--mono-font)', fontSize: 12, marginBottom: 8 }}>
                  배포 실패
                </p>
                <p className="px-4 py-2 whitespace-pre-wrap"
                  style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10, lineHeight: 1.6, maxWidth: 320, marginBottom: 12 }}>
                  {deployError}
                </p>
              </div>
              <div className="flex gap-2">
                {githubRepo && (
                  <a
                    href={`https://github.com/${githubRepo.owner}/${githubRepo.repo}/actions`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1"
                    style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10, padding: '6px 12px', background: 'var(--bg-panel)', border: '1px solid var(--border)', textDecoration: 'none' }}
                  >
                    <ExternalLink style={{ width: 10, height: 10 }} /> 로그 보기
                  </a>
                )}
                <button
                  onClick={() => {
                    if (githubRepo) {
                      startDeploy(githubRepo.owner, githubRepo.repo, githubRepo.branch, deployToken)
                    }
                  }}
                  className="flex items-center gap-1.5 transition-all"
                  style={{ color: '#fff', fontFamily: 'var(--mono-font)', fontSize: 10, padding: '6px 12px', background: 'var(--accent)', border: 'none', cursor: 'pointer' }}
                >
                  다시 배포
                </button>
              </div>
            </div>
          ) : deployStep === 'needs-token' ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div style={{
                width: 56, height: 56,
                background: 'var(--bg-panel)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <KeyRound style={{ width: 24, height: 24, color: 'var(--txt-3)' }} />
              </div>
              <div className="text-center">
                <p style={{ color: 'var(--txt)', fontFamily: 'var(--mono-font)', fontSize: 12, marginBottom: 6 }}>
                  GitHub 토큰 입력 후 자동 배포
                </p>
                <p style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10, lineHeight: 1.7, maxWidth: 280 }}>
                  토큰을 입력하면 즉시 GitHub Pages 배포가 시작됩니다.
                </p>
              </div>
              <div className="flex flex-col gap-1.5" style={{ width: 280 }}>
                <div className="flex items-center gap-2 px-3 py-2"
                  style={{ background: 'var(--bg)', border: `1px solid ${deployToken ? 'var(--ok-bd)' : 'var(--border)'}` }}>
                  <KeyRound style={{ width: 12, height: 12, flexShrink: 0, color: 'var(--txt-3)' }} />
                  <input
                    type="password"
                    value={deployToken}
                    autoFocus
                    onChange={e => { setDeployToken(e.target.value); setDeployError('') }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && deployToken.trim() && githubRepo) {
                        startDeploy(githubRepo.owner, githubRepo.repo, githubRepo.branch, deployToken.trim())
                      }
                    }}
                    placeholder="ghp_xxxxxxxxxxxx  (Enter로 배포 시작)"
                    className="flex-1 bg-transparent outline-none"
                    style={{ color: 'var(--txt)', fontFamily: 'var(--mono-font)', fontSize: 11 }}
                  />
                </div>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=VibeCoding"
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-1"
                  style={{ color: 'var(--accent)', fontFamily: 'var(--mono-font)', fontSize: 10 }}
                >
                  <ExternalLink style={{ width: 10, height: 10 }} /> create token with repo + workflow scope
                </a>
              </div>
              {deployError && (
                <p className="px-3 py-2 whitespace-pre-wrap text-center"
                  style={{ color: 'var(--err)', background: 'var(--err-bg)', border: '1px solid var(--err-bd)', fontFamily: 'var(--mono-font)', fontSize: 10, maxWidth: 300, lineHeight: 1.6 }}>
                  {deployError}
                </p>
              )}
            </div>
          ) : deployStep === 'deploy-done' ? (
            /* 배포 완료 화면 — 미리보기 버튼 제공 */
            <div className="flex-1 flex flex-col items-center justify-center gap-5">
              <div style={{
                width: 56, height: 56,
                background: 'var(--ok-bg)',
                border: '1px solid var(--ok-bd)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Check style={{ width: 24, height: 24, color: 'var(--ok)' }} />
              </div>
              <div className="text-center">
                <p style={{ color: 'var(--txt)', fontFamily: 'var(--mono-font)', fontSize: 13, marginBottom: 8 }}>
                  배포 완료!
                </p>
                {deployUrl && (
                  <p style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10, lineHeight: 1.6, maxWidth: 320, wordBreak: 'break-all' }}>
                    {deployUrl}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={openPreviewFromDeploy}
                  className="flex items-center gap-2 transition-colors"
                  style={{ background: 'var(--accent)', color: '#fff', fontFamily: 'var(--mono-font)', fontSize: 11, padding: '8px 20px', border: 'none', cursor: 'pointer' }}
                >
                  <Eye style={{ width: 13, height: 13 }} /> 미리보기 열기
                </button>
                {deployUrl && (
                  <button
                    onClick={() => window.open(deployUrl, '_blank')}
                    className="flex items-center gap-1.5 transition-all"
                    style={{ color: 'var(--txt-2)', fontFamily: 'var(--mono-font)', fontSize: 10, padding: '8px 14px', background: 'var(--bg-panel)', border: '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    <ExternalLink style={{ width: 11, height: 11 }} /> 새 탭
                  </button>
                )}
              </div>
              {githubRepo && (
                <p style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
                  {githubRepo.owner}/{githubRepo.repo} · {githubRepo.branch}
                </p>
              )}
            </div>
          ) : hasFiles && (projectType === 'react' || projectType === 'vue') ? (
            /* AI 생성 React/Vue — GitHub 내보내기 필요 */
            <div className="flex-1 flex flex-col items-center justify-center gap-5">
              <div style={{
                width: 56, height: 56,
                background: 'var(--accent-bg)',
                border: '1px solid var(--accent-bd)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <GitFork style={{ width: 24, height: 24, color: 'var(--accent)' }} />
              </div>
              <div className="text-center">
                <p style={{ color: 'var(--txt)', fontFamily: 'var(--mono-font)', fontSize: 12, marginBottom: 8 }}>
                  {projectType === 'vue' ? 'vue' : 'react'} project generated
                </p>
                <p style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10, lineHeight: 1.7, maxWidth: 260 }}>
                  {projectType === 'vue' ? 'Vue' : 'React'} requires a build step.<br />
                  Push to GitHub → auto deploys and opens preview.
                </p>
              </div>
              <button
                onClick={() => setShowExport(true)}
                className="flex items-center gap-2 transition-colors"
                style={{ background: 'var(--accent)', color: '#fff', fontFamily: 'var(--mono-font)', fontSize: 11, padding: '8px 20px', border: 'none', cursor: 'pointer' }}>
                <GitFork style={{ width: 14, height: 14 }} /> push to github & preview
              </button>
              <div className="flex flex-wrap gap-1.5 justify-center" style={{ maxWidth: 280 }}>
                {fileNames.slice(0, 6).map(name => (
                  <span key={name} style={{ background: 'var(--bg-panel)', color: 'var(--txt-3)', border: '1px solid var(--border-s)', fontFamily: 'var(--mono-font)', fontSize: 10, padding: '2px 8px' }}>
                    {name}
                  </span>
                ))}
                {fileNames.length > 6 && (
                  <span style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
                    +{fileNames.length - 6} more
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center gap-5">
              <div style={{
                width: 48, height: 48,
                background: 'var(--bg-panel)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FileCode2 style={{ width: 22, height: 22, color: 'var(--txt-3)' }} />
              </div>
              <div className="text-center">
                <p style={{ color: 'var(--txt-2)', fontFamily: 'var(--mono-font)', fontSize: 11, marginBottom: 6 }}>
                  no output yet
                </p>
                <p style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
                  describe what to build in the chat panel
                </p>
              </div>
              <div className="px-4 py-3" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', fontFamily: 'var(--mono-font)', fontSize: 11, lineHeight: 1.8 }}>
                <div>
                  <span style={{ color: '#c084fc' }}>const </span>
                  <span style={{ color: 'var(--accent)' }}>app </span>
                  <span style={{ color: 'var(--txt-3)' }}>= </span>
                  <span style={{ color: '#60a5fa' }}>await </span>
                  <span style={{ color: 'var(--ok)' }}>vibeCode</span>
                  <span style={{ color: 'var(--txt-3)' }}>(</span>
                  <span style={{ color: '#fbbf24' }}>"your idea"</span>
                  <span style={{ color: 'var(--txt-3)' }}>)</span>
                </div>
                <div>
                  <span style={{ color: '#60a5fa' }}>await </span>
                  <span style={{ color: 'var(--ok)' }}>app.deploy</span>
                  <span style={{ color: 'var(--txt-3)' }}>()</span>
                  <span style={{ color: 'var(--txt-3)', opacity: 0.5 }}>  // ✨</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Code tab */}
        <div ref={codeTabRef} className={`absolute inset-0 ${tab === 'code' ? 'flex' : 'hidden'}`}>
          {hasFiles ? (
            <>
              <div className="flex flex-col flex-shrink-0 overflow-y-auto"
                style={{ width: fileListWidth, background: 'var(--bg-panel)' }}>
                <div className="px-3 py-2 select-none"
                  style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 9, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-s)' }}>
                  FILES
                </div>
                {fileNames.map(name => (
                  <button key={name} onClick={() => setSelectedFile(name)}
                    className="flex items-center gap-2 px-3 py-1.5 text-left w-full min-w-0 transition-colors"
                    style={selectedFile === name
                      ? { background: 'var(--accent-bg)', color: 'var(--txt)', borderRight: '2px solid var(--accent)', fontFamily: 'var(--mono-font)', fontSize: 10 }
                      : { color: 'var(--txt-2)', borderRight: '2px solid transparent', fontFamily: 'var(--mono-font)', fontSize: 10 }}
                    onMouseEnter={e => { if (selectedFile !== name) e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { if (selectedFile !== name) e.currentTarget.style.background = 'transparent' }}
                    title={name}>
                    {fileIcon(name)}
                    <span className="truncate min-w-0">{name}</span>
                  </button>
                ))}
              </div>
              <div
                onMouseDown={startResizeFileList}
                className="flex-shrink-0"
                style={{ width: 1, cursor: 'col-resize', background: 'var(--border)' }}
                title="Drag to resize file list"
              />
              <div className="flex-1 overflow-hidden" style={{ background: 'var(--bg)' }}>
                <div className="flex items-center justify-between px-3"
                  style={{ height: 28, borderBottom: '1px solid var(--border-s)', background: 'var(--bg-panel)' }}>
                  <span style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
                    editing: {selectedFile}
                  </span>
                  <span style={{ color: saveLabel === 'saved' ? 'var(--ok)' : 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
                    {saveLabel}
                  </span>
                </div>
                <div className="flex h-full">
                  <div className="overflow-hidden select-none"
                    style={{ width: 56, borderRight: '1px solid var(--border-s)', background: 'var(--bg-panel)' }}>
                    <div className="h-full overflow-auto px-2 py-2">
                      {Array.from({ length: selectedLineCount }).map((_, i) => (
                        <div key={i}
                          style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10, lineHeight: 1.6, textAlign: 'right' }}>
                          {i + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={selectedContent}
                    onChange={(e) => updateSelectedFileContent(e.target.value)}
                    spellCheck={false}
                    className="flex-1 w-full h-full resize-none outline-none"
                    style={{
                      background: 'var(--bg)',
                      color: 'var(--txt-2)',
                      fontFamily: 'var(--mono-font)',
                      fontSize: 11,
                      lineHeight: 1.6,
                      padding: '8px 12px',
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center w-full h-full"
              style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 11 }}>
              no code generated yet
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 flex-shrink-0 select-none"
        style={{ background: 'var(--bg-panel)', borderTop: '1px solid var(--border)', height: 24, color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--txt-2)' }}>vibe-coding-web</span>
          {hasFiles && (
            <>
              <span>/</span>
              <span style={{ color: '#fbbf24', opacity: 0.8 }}>
                {tab === 'code' ? selectedFile : 'index.html'}
              </span>
              {(projectType === 'react' || projectType === 'vue') && (
                <span style={{ background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 9, padding: '1px 6px', border: '1px solid var(--accent-bd)' }}>
                  {projectType === 'vue' ? 'vue' : 'react'}
                </span>
              )}
            </>
          )}
          {isLoading && (
            <span className="flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              <PixelMiniBar /> generating
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          {hasFiles && <span>{fileNames.length} files · {totalLines} lines</span>}
        </div>
      </div>

      {/* Export Modal */}
      {showExport && (
        <ExportModal
          files={files}
          githubRepo={githubRepo}
          onClose={() => setShowExport(false)}
          onSuccess={handleExportSuccess}
        />
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  )
}