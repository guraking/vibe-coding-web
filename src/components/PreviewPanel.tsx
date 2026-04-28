import { useState, useRef, useEffect, useMemo } from 'react'
import { Eye, Code2, Copy, Check, ExternalLink, Loader2, FileCode2, RefreshCw, FileText, FileJson, Palette, GitFork } from 'lucide-react'
import ExportModal from './ExportModal'

interface Props {
  files: Record<string, string>
  projectType: 'html' | 'react' | 'vue'
  previewVersion: number
  isLoading: boolean
}

type Tab = 'preview' | 'code'

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

export default function PreviewPanel({ files, projectType, previewVersion, isLoading }: Props) {
  const [tab, setTab] = useState<Tab>('preview')
  const [selectedFile, setSelectedFile] = useState('index.html')
  const [copied, setCopied] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeKey, setIframeKey] = useState(0)
  const blobUrlRef = useRef<string>('')
  const [showExport, setShowExport] = useState(false)
  const [githubRepo, setGithubRepo] = useState<{ owner: string; repo: string } | null>(null)

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

  // CodeSandbox URL after GitHub export
  const sandboxUrl = githubRepo
    ? `https://codesandbox.io/embed/github/${githubRepo.owner}/${githubRepo.repo}/tree/main?fontsize=13&theme=dark&view=preview&hidenavigation=1`
    : ''

  useEffect(() => {
    if (previewVersion > 0) setIframeKey(k => k + 1)
  }, [previewVersion])

  // Reset github repo when new project is generated
  useEffect(() => {
    if (hasFiles) {
      setGithubRepo(null)
      setSelectedFile(fileNames[0] || 'index.html')
    }
  }, [files])

  useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current) }, [])

  const selectedContent = files[selectedFile] || ''
  const totalLines = Object.values(files).reduce((s, c) => s + c.split('\n').length, 0)

  const copyFile = async () => {
    await navigator.clipboard.writeText(selectedContent)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  const refresh = () => setIframeKey(k => k + 1)
  const openNew = () => {
    if (sandboxUrl) window.open(`https://codesandbox.io/p/github/${githubRepo!.owner}/${githubRepo!.repo}/main`, '_blank')
    else if (blobUrl) window.open(blobUrl, '_blank')
  }

  const handleExportSuccess = (owner: string, repo: string) => {
    setGithubRepo({ owner, repo })
    setShowExport(false)
    setIframeKey(k => k + 1)
  }

  // What to show in preview iframe
  const previewSrc = sandboxUrl ? sandboxUrl : blobUrl

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
            <button onClick={refresh}
              className="flex items-center justify-center transition-all"
              style={{ width: 32, height: 32, color: 'var(--txt-3)', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--txt-2)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt-3)'; e.currentTarget.style.background = 'transparent' }}
              title="Refresh">
              <RefreshCw style={{ width: 12, height: 12 }} />
            </button>
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
          {previewSrc ? (
            <iframe key={iframeKey} ref={iframeRef} src={previewSrc}
              className="w-full h-full border-0" allow="fullscreen" title="Preview" />
          ) : hasFiles && (projectType === 'react' || projectType === 'vue') ? (
            /* React / Vue project — needs GitHub export */
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
                  Export to GitHub → StackBlitz runs it instantly.
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
    </div>
  )
}