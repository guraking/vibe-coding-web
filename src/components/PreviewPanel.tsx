import { useState, useRef, useEffect, useMemo } from 'react'
import { Eye, Code2, Copy, Check, ExternalLink, Loader2, FileCode2, RefreshCw, FileText, FileJson, Palette, GitFork, FolderGit2, KeyRound, History } from 'lucide-react'
import ExportModal from './ExportModal'
import ImportModal from './ImportModal'
import { fetchDeploymentUrl, deployToGitHubPages } from '../services/github'

interface Props {
  files: Record<string, string>
  projectType: 'html' | 'react' | 'vue'
  isLoading: boolean
  onImport: (files: Record<string, string>, projectType: 'html' | 'react' | 'vue') => void
}

type GithubRepo = { owner: string; repo: string; branch: string }
type DeploymentHistoryItem = { owner: string; repo: string; branch: string; url: string; deployedAt: number }

type Tab = 'preview' | 'code'

const DEPLOY_HISTORY_KEY = 'vibe_deploy_history'

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

export default function PreviewPanel({ files, projectType, isLoading, onImport }: Props) {
  const [tab, setTab] = useState<Tab>('preview')
  const [selectedFile, setSelectedFile] = useState('index.html')
  const [copied, setCopied] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeKey, setIframeKey] = useState(0)
  const blobUrlRef = useRef<string>('')
  const isImportRef = useRef(false)
  const [showExport, setShowExport] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [githubRepo, setGithubRepo] = useState<GithubRepo | null>(null)
  const [deployUrl, setDeployUrl] = useState<string | null>(null)
  const [deployStatus, setDeployStatus] = useState('')
  const [deployError, setDeployError] = useState('')
  const [deployStep, setDeployStep] = useState<'idle' | 'checking' | 'deploying' | 'needs-token'>('idle')
  const [deployToken, setDeployToken] = useState(() => localStorage.getItem('vibe_gh_token') || '')
  const [deployUrlCopied, setDeployUrlCopied] = useState(false)
  const [deployHistory, setDeployHistory] = useState<DeploymentHistoryItem[]>(() => loadDeployHistory())

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

  // StackBlitz 대신 GitHub Deployments에서 가져온 실제 배포 URL 사용
  // HTML은 로컬 blob, React/Vue는 deployUrl
  const previewSrc = blobUrl || deployUrl || ''

  useEffect(() => {
    if (hasFiles) {
      if (isImportRef.current) {
        isImportRef.current = false
        setSelectedFile(fileNames[0] || 'index.html')
        return
      }
      setGithubRepo(null)
      setDeployUrl(null)
      setSelectedFile(fileNames[0] || 'index.html')
    }
  }, [files])

  useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current) }, [])

  const selectedContent = files[selectedFile] || ''
  const totalLines = Object.values(files).reduce((s, c) => s + c.split('\n').length, 0)
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

  const handleExportSuccess = async (owner: string, repo: string, token: string) => {
    setGithubRepo({ owner, repo, branch: 'main' })
    setDeployUrl(null)
    setDeployError('')
    setDeployStep('idle')
    setShowExport(false)
    setTab('preview')
    setIframeKey(k => k + 1)

    // React/Vue는 push 완료 직후 자동 배포 후 preview에 배포 URL 표시
    if (projectType === 'react' || projectType === 'vue') {
      await startDeploy(owner, repo, 'main', token)
    }
  }

  const startDeploy = async (owner: string, repo: string, branch: string, token: string) => {
    localStorage.setItem('vibe_gh_token', token)
    setDeployToken(token)
    setDeployStep('deploying')
    setDeployError('')
    setDeployStatus('')
    try {
      const url = await deployToGitHubPages(token, owner, repo, branch, setDeployStatus)
      setDeployUrl(url)
      persistDeployment(owner, repo, branch, url)
      setDeployStatus('')
      setDeployStep('idle')
      setIframeKey(k => k + 1)
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : '배포 실패')
      setDeployStatus('')
      setDeployStep('idle')
    }
  }

  const handleImportSuccess = async (importedFiles: Record<string, string>, importedType: 'html' | 'react' | 'vue', owner: string, repo: string, branch: string) => {
    isImportRef.current = true
    setShowImport(false)
    setGithubRepo({ owner, repo, branch })
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
        <Loader2 style={{ width: 10, height: 10, marginLeft: 4, color: 'var(--accent)' }} className="animate-spin" />
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
            <span className="w-1.5 h-1.5 animate-pulse" style={{ background: 'var(--accent)', display: 'inline-block' }} />
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
                  style={{ color: 'var(--txt-2)', fontFamily: 'var(--mono-font)', fontSize: 10, height: 28, maxWidth: 250 }}
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
            /* AI 생성 중 */
            <div className="flex-1 flex flex-col items-center justify-center gap-8" style={{ background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
              {/* Background gradient blur */}
              <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 280, height: 280,
                background: `radial-gradient(circle, var(--accent-bg) 0%, transparent 70%)`,
                filter: 'blur(40px)',
                zIndex: 0,
              }} />
              
              {/* Main content */}
              <div className="relative z-10 flex flex-col items-center gap-8">
                {/* Large animated icon */}
                <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
                  {/* Outer rotating ring */}
                  <div style={{
                    position: 'absolute',
                    width: '100%', height: '100%',
                    border: '2px solid transparent',
                    borderTopColor: 'var(--accent)',
                    borderRightColor: 'var(--accent)',
                    borderRadius: '50%',
                    animation: 'spin 2.4s linear infinite',
                  }} />
                  
                  {/* Middle pulsing ring */}
                  <div style={{
                    position: 'absolute',
                    width: '75%', height: '75%',
                    border: '1px solid var(--accent)',
                    borderRadius: '50%',
                    opacity: 0.4,
                    animation: 'pulse-scale 2s ease-in-out infinite',
                  }} />
                  
                  {/* Center icon */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 56, height: 56,
                    background: 'var(--accent)',
                    borderRadius: 12,
                    position: 'relative',
                    zIndex: 1,
                    boxShadow: '0 8px 24px rgba(232, 65, 10, 0.3)',
                  }}>
                    <Loader2 style={{ width: 28, height: 28, color: '#fff' }} className="animate-spin" />
                  </div>
                </div>

                {/* Text content */}
                <div className="text-center flex flex-col gap-3">
                  <div>
                    <p style={{ 
                      color: 'var(--txt)', 
                      fontFamily: 'var(--mono-font)', 
                      fontSize: 18, 
                      fontWeight: 600, 
                      letterSpacing: '-0.3px',
                      lineHeight: 1.2,
                    }}>
                      AI가 생성 중입니다
                    </p>
                    <p style={{ 
                      color: 'var(--accent)', 
                      fontFamily: 'var(--mono-font)', 
                      fontSize: 13, 
                      fontStyle: 'italic',
                      fontWeight: 500,
                      marginTop: 4,
                    }}>
                      generating amazing code...
                    </p>
                  </div>
                  <p style={{ 
                    color: 'var(--txt-3)', 
                    fontFamily: 'var(--mono-font)', 
                    fontSize: 11, 
                    lineHeight: 1.6,
                    maxWidth: 240,
                  }}>
                    멋진 프로젝트를 만들고 있어요
                  </p>
                </div>

                {/* Animated dots */}
                <div className="flex gap-3" style={{ marginTop: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      style={{
                        width: 8, height: 8,
                        background: 'var(--accent)',
                        borderRadius: '50%',
                        animation: `wave 1.6s ease-in-out infinite`,
                        animationDelay: `${i * 0.2}s`,
                        boxShadow: '0 0 12px var(--accent)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : previewSrc ? (
            <iframe key={iframeKey} ref={iframeRef} src={previewSrc}
              className="w-full h-full border-0" allow="fullscreen" title="Preview" />
          ) : deployStep === 'checking' ? (
            /* 임포트 직후 기존 배포 URL 조회 중 */
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Loader2 style={{ width: 20, height: 20, color: 'var(--accent)' }} className="animate-spin" />
              <p style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 11 }}>
                기존 배포 URL 확인 중...
              </p>
            </div>
          ) : deployStep === 'deploying' ? (
            /* GitHub Pages 배포 진행 중 */
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div style={{
                width: 56, height: 56,
                background: 'var(--accent-bg)',
                border: '1px solid var(--accent-bd)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Loader2 style={{ width: 24, height: 24, color: 'var(--accent)' }} className="animate-spin" />
              </div>
              <div className="text-center flex flex-col gap-1.5">
                <p style={{ color: 'var(--txt)', fontFamily: 'var(--mono-font)', fontSize: 12 }}>
                  GitHub Pages 배포 중
                </p>
                <p style={{ color: 'var(--accent)', fontFamily: 'var(--mono-font)', fontSize: 10, minHeight: 16 }}>
                  {deployStatus || '준비 중...'}
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
            </div>
          ) : deployStep === 'needs-token' ? (
            /* 임포트한 React/Vue — 토큰 없어서 자동 배포 대기 중 */
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
                <GitFork style={{ width: 14, height: 14 }} /> push to github &amp; preview
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
        <div className={`absolute inset-0 ${tab === 'code' ? 'flex' : 'hidden'}`}>
          {hasFiles ? (
            <>
              <div className="flex flex-col flex-shrink-0 overflow-y-auto"
                style={{ width: 160, background: 'var(--bg-panel)', borderRight: '1px solid var(--border)' }}>
                <div className="px-3 py-2 select-none"
                  style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 9, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-s)' }}>
                  FILES
                </div>
                {fileNames.map(name => (
                  <button key={name} onClick={() => setSelectedFile(name)}
                    className="flex items-center gap-2 px-3 py-1.5 text-left w-full transition-colors"
                    style={selectedFile === name
                      ? { background: 'var(--accent-bg)', color: 'var(--txt)', borderRight: '2px solid var(--accent)', fontFamily: 'var(--mono-font)', fontSize: 10 }
                      : { color: 'var(--txt-2)', borderRight: '2px solid transparent', fontFamily: 'var(--mono-font)', fontSize: 10 }}
                    onMouseEnter={e => { if (selectedFile !== name) e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { if (selectedFile !== name) e.currentTarget.style.background = 'transparent' }}>
                    {fileIcon(name)}
                    <span className="truncate">{name}</span>
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-auto" style={{ background: 'var(--bg)' }}>
                <table className="w-full border-collapse min-w-full">
                  <tbody>
                    {selectedContent.split('\n').map((line, i) => (
                      <tr key={i} className="transition-colors"
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-panel)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td className="text-right select-none align-top py-px pl-4 pr-4"
                          style={{ color: 'var(--txt-3)', borderRight: '1px solid var(--border-s)', minWidth: '3rem', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
                          {i + 1}
                        </td>
                        <td className="align-top py-px pl-4 pr-8 whitespace-pre-wrap break-all"
                          style={{ color: 'var(--txt-2)', fontFamily: 'var(--mono-font)', fontSize: 11 }}>
                          {line || ' '}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              <Loader2 style={{ width: 10, height: 10 }} className="animate-spin" /> generating
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