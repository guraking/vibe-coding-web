import { useState, useRef, useEffect, useMemo } from 'react'
import { Eye, Code2, Copy, Check, ExternalLink, Loader2, FileCode2, RefreshCw, FileText, FileJson, Palette } from 'lucide-react'

interface Props {
  files: Record<string, string>
  previewVersion: number
  isLoading: boolean
}

type Tab = 'preview' | 'code'

/** Inline CSS/JS files into a single self-contained HTML blob */
function bundleFiles(files: Record<string, string>): string {
  let html = files['index.html'] || ''

  // inline <link rel="stylesheet" href="*.css">
  html = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+\.css)["'][^>]*\/?>/gi, (_m, href) => {
    const key = href.replace(/^\.\//, '')
    const css = files[key] || files['./' + key]
    return css ? `<style>\n${css}\n</style>` : _m
  })
  html = html.replace(/<link[^>]+href=["']([^"']+\.css)["'][^>]+rel=["']stylesheet["'][^>]*\/?>/gi, (_m, href) => {
    const key = href.replace(/^\.\//, '')
    const css = files[key] || files['./' + key]
    return css ? `<style>\n${css}\n</style>` : _m
  })

  // inline <script src="*.js">
  html = html.replace(/<script([^>]+)src=["']([^"']+\.(js|mjs))["']([^>]*)><\/script>/gi, (_m, pre, src, _ext, post) => {
    const key = src.replace(/^\.\//, '')
    const js = files[key] || files['./' + key]
    return js ? `<script${pre}${post}>\n${js}\n</script>` : _m
  })

  // Ensure Tailwind CDN if not already present
  if (!html.includes('cdn.tailwindcss.com')) {
    html = html.replace('</head>', '  <script src="https://cdn.tailwindcss.com"></script>\n</head>')
  }

  return html
}

function fileIcon(name: string) {
  if (name.endsWith('.css')) return <Palette className="w-3.5 h-3.5 shrink-0" style={{ color: '#60a5fa' }} />
  if (name.endsWith('.json')) return <FileJson className="w-3.5 h-3.5 shrink-0" style={{ color: '#fbbf24' }} />
  if (name.endsWith('.js') || name.endsWith('.ts')) return <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: '#f59e0b' }} />
  return <FileCode2 className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ok)' }} />
}

export default function PreviewPanel({ files, previewVersion, isLoading }: Props) {
  const [tab, setTab] = useState<Tab>('preview')
  const [selectedFile, setSelectedFile] = useState('index.html')
  const [copied, setCopied] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeKey, setIframeKey] = useState(0)
  const blobUrlRef = useRef<string>('')

  const fileNames = Object.keys(files).sort((a, b) => {
    const order = ['index.html']
    const ai = order.indexOf(a), bi = order.indexOf(b)
    if (ai >= 0 && bi < 0) return -1
    if (bi >= 0 && ai < 0) return 1
    const ext = (f: string) => f.split('.').pop() || ''
    const extOrder = ['html', 'css', 'js', 'ts', 'json']
    return (extOrder.indexOf(ext(a)) - extOrder.indexOf(ext(b))) || a.localeCompare(b)
  })

  const hasFiles = fileNames.length > 0

  const blobUrl = useMemo(() => {
    if (!hasFiles || !files['index.html']) return ''
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    const bundled = bundleFiles(files)
    const url = URL.createObjectURL(new Blob([bundled], { type: 'text/html' }))
    blobUrlRef.current = url
    return url
  }, [files])

  useEffect(() => {
    if (previewVersion > 0) setIframeKey(k => k + 1)
  }, [previewVersion])

  useEffect(() => {
    if (hasFiles && !files[selectedFile]) setSelectedFile(fileNames[0])
  }, [files])

  useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current) }, [])

  const selectedContent = files[selectedFile] || ''
  const totalLines = Object.values(files).reduce((s, c) => s + c.split('\n').length, 0)

  const copyFile = async () => {
    await navigator.clipboard.writeText(selectedContent)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  const refresh = () => setIframeKey(k => k + 1)
  const openNew = () => { if (blobUrl) window.open(blobUrl, '_blank') }

  const TabBtn = ({ id, icon: Icon, label }: { id: Tab; icon: React.ElementType; label: string }) => (
    <button onClick={() => setTab(id)}
      className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-all"
      style={tab === id ? { background: 'var(--bg-hover)', color: 'var(--txt)' } : { color: 'var(--txt-3)' }}
      onMouseEnter={e => { if (tab !== id) e.currentTarget.style.color = 'var(--txt-2)' }}
      onMouseLeave={e => { if (tab !== id) e.currentTarget.style.color = 'var(--txt-3)' }}>
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
      {id === 'preview' && isLoading && (
        <Loader2 className="w-3 h-3 animate-spin ml-1" style={{ color: 'var(--accent)' }} />
      )}
    </button>
  )

  return (
    <div className="flex flex-col flex-1 min-w-0" style={{ background: 'var(--bg)' }}>
      {/* Tab bar */}
      <div className="flex items-center h-11 px-2 gap-1 flex-shrink-0"
        style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)' }}>
        <TabBtn id="preview" icon={Eye} label="미리보기" />
        <TabBtn id="code" icon={Code2} label={`코드${hasFiles ? ` (${fileNames.length})` : ''}`} />
        <div className="flex-1" />

        {isLoading && (
          <div className="flex items-center gap-1.5 text-xs mr-2" style={{ color: 'var(--accent)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
            생성 중...
          </div>
        )}

        {blobUrl && tab === 'preview' && (
          <>
            <button onClick={refresh}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-all"
              style={{ color: 'var(--txt-3)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--txt-2)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt-3)'; e.currentTarget.style.background = 'transparent' }}
              title="새로고침">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={openNew}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs transition-all"
              style={{ color: 'var(--txt-3)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--txt-2)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt-3)'; e.currentTarget.style.background = 'transparent' }}>
              <ExternalLink className="w-3.5 h-3.5" /><span>새 탭</span>
            </button>
          </>
        )}
        {hasFiles && tab === 'code' && (
          <button onClick={copyFile}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs transition-all"
            style={copied ? { color: 'var(--ok)', background: 'var(--ok-bg)' } : { color: 'var(--txt-3)' }}
            onMouseEnter={e => { if (!copied) { e.currentTarget.style.color = 'var(--txt-2)'; e.currentTarget.style.background = 'var(--bg-hover)' } }}
            onMouseLeave={e => { if (!copied) { e.currentTarget.style.color = 'var(--txt-3)'; e.currentTarget.style.background = 'transparent' } }}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '복사됨' : '복사'}</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Preview tab */}
        <div className={`absolute inset-0 ${tab === 'preview' ? 'flex' : 'hidden'} flex-col`}>
          {blobUrl ? (
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={blobUrl}
              className="w-full h-full border-0"
              allow="fullscreen"
              title="Preview"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
                <FileCode2 className="w-6 h-6" style={{ color: 'var(--txt-3)' }} />
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-sm font-semibold" style={{ color: 'var(--txt-2)' }}>아직 생성된 화면이 없습니다</p>
                <p className="text-xs" style={{ color: 'var(--txt-3)' }}>왼쪽 채팅에서 만들고 싶은 것을 설명하세요</p>
              </div>
              <div className="px-4 py-3 rounded-xl font-mono text-xs leading-relaxed"
                style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
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
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider select-none"
                  style={{ color: 'var(--txt-3)' }}>파일</div>
                {fileNames.map(name => (
                  <button key={name} onClick={() => setSelectedFile(name)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-left w-full transition-colors"
                    style={selectedFile === name
                      ? { background: 'var(--accent-bg)', color: 'var(--txt)', borderRight: '2px solid var(--accent)' }
                      : { color: 'var(--txt-2)', borderRight: '2px solid transparent' }}
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
                        <td className="text-right text-xs font-mono select-none align-top py-px pl-4 pr-4"
                          style={{ color: 'var(--txt-3)', borderRight: '1px solid var(--border-s)', minWidth: '3rem' }}>
                          {i + 1}
                        </td>
                        <td className="text-xs font-mono align-top py-px pl-4 pr-8 whitespace-pre-wrap break-all"
                          style={{ color: 'var(--txt-2)' }}>
                          {line || ' '}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center w-full h-full text-xs" style={{ color: 'var(--txt-3)' }}>
              아직 생성된 코드가 없습니다
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 h-6 flex-shrink-0 text-xs select-none"
        style={{ background: 'var(--bg-panel)', borderTop: '1px solid var(--border)', color: 'var(--txt-3)' }}>
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--txt-2)' }}>vibe-coding-web</span>
          {hasFiles && (
            <>
              <span>/</span>
              <span style={{ color: '#fbbf24', opacity: 0.8 }}>
                {tab === 'code' ? selectedFile : 'index.html'}
              </span>
            </>
          )}
          {isLoading && (
            <span className="flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              <Loader2 className="w-2.5 h-2.5 animate-spin" /> 생성 중
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          {hasFiles && <span>{fileNames.length}개 파일 · {totalLines} lines</span>}
        </div>
      </div>
    </div>
  )
}