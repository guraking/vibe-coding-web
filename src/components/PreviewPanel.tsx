import { useState, useEffect, useRef } from 'react'
import { Eye, Code2, Copy, Check, ExternalLink, Loader2, FileCode2, RefreshCw } from 'lucide-react'

function prepareHtml(raw: string): string {
  const trimmed = raw.trim()
  const isFullDoc = /<!doctype\s+html/i.test(trimmed)

  let doc = isFullDoc ? trimmed : `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>* { font-family: 'Inter', sans-serif; } body { margin: 0; }</style>
</head>
<body>
${trimmed}
</body>
</html>`

  // 완전한 문서지만 Tailwind가 없으면 주입
  if (isFullDoc && !doc.includes('cdn.tailwindcss.com')) {
    doc = doc.replace('</head>', '  <script src="https://cdn.tailwindcss.com"></script>\n</head>')
  }

  return doc
}

interface Props {
  html: string
  code: string
  isLoading: boolean
}

type Tab = 'preview' | 'code'

export default function PreviewPanel({ html, code, isLoading }: Props) {
  const [tab, setTab] = useState<Tab>('preview')
  const [copied, setCopied] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const prevUrlRef = useRef<string>('')

  useEffect(() => {
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
    if (!html) { setPreviewUrl(''); prevUrlRef.current = ''; return }
    const blob = new Blob([prepareHtml(html)], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    setPreviewUrl(url)
    prevUrlRef.current = url
    return () => { URL.revokeObjectURL(url) }
  }, [html])

  const copyCode = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  const openNew = () => {
    if (previewUrl) window.open(previewUrl, '_blank')
  }
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const refresh = () => { if (iframeRef.current) iframeRef.current.src = iframeRef.current.src }

  const Tab = ({ id, icon: Icon, label }: { id: 'preview' | 'code', icon: React.ElementType, label: string }) => (
    <button onClick={() => setTab(id)}
      className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-all"
      style={tab === id
        ? { background: 'var(--bg-hover)', color: 'var(--txt)' }
        : { color: 'var(--txt-3)' }}
      onMouseEnter={e => { if (tab !== id) e.currentTarget.style.color = 'var(--txt-2)' }}
      onMouseLeave={e => { if (tab !== id) e.currentTarget.style.color = 'var(--txt-3)' }}>
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
      {id === 'preview' && isLoading && tab === id && <Loader2 className="w-3 h-3 animate-spin ml-1" style={{ color: 'var(--accent)' }} />}
    </button>
  )

  return (
    <div className="flex flex-col flex-1 min-w-0" style={{ background: 'var(--bg)' }}>
      {/* Tab bar */}
      <div className="flex items-center h-11 px-2 gap-1 flex-shrink-0"
        style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)' }}>
        <Tab id="preview" icon={Eye} label="미리보기" />
        <Tab id="code" icon={Code2} label="코드" />
        <div className="flex-1" />

        {isLoading && (
          <div className="flex items-center gap-1.5 text-xs mr-2" style={{ color: 'var(--accent)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
            생성 중...
          </div>
        )}

        {previewUrl && tab === 'preview' && (
          <button onClick={refresh}
            className="flex items-center justify-center w-7 h-7 rounded-md text-xs transition-all"
            style={{ color: 'var(--txt-3)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--txt-2)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt-3)'; e.currentTarget.style.background = 'transparent' }}
            title="새로고침">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
        {code && tab === 'code' && (
          <button onClick={copyCode}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs transition-all"
            style={copied
              ? { color: 'var(--ok)', background: 'var(--ok-bg)' }
              : { color: 'var(--txt-3)' }}
            onMouseEnter={e => { if (!copied) { e.currentTarget.style.color = 'var(--txt-2)'; e.currentTarget.style.background = 'var(--bg-hover)' } }}
            onMouseLeave={e => { if (!copied) { e.currentTarget.style.color = 'var(--txt-3)'; e.currentTarget.style.background = 'transparent' } }}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '복사됨' : '복사'}</span>
          </button>
        )}
        {code && tab === 'preview' && (
          <button onClick={openNew}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs transition-all"
            style={{ color: 'var(--txt-3)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--txt-2)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt-3)'; e.currentTarget.style.background = 'transparent' }}>
            <ExternalLink className="w-3.5 h-3.5" /><span>새 탭</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Preview */}
        <div className={`absolute inset-0 flex flex-col ${tab === 'preview' ? '' : 'hidden'}`}>
          {previewUrl ? (
            <iframe ref={iframeRef} src={previewUrl} className="w-full h-full border-0"
              allow="fullscreen" title="Preview" />
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

        {/* Code */}
        <div className={`absolute inset-0 overflow-auto ${tab === 'code' ? 'block' : 'hidden'}`}
          style={{ background: 'var(--bg)' }}>
          {code ? (
            <table className="w-full border-collapse min-w-full">
              <tbody>
                {code.split('\n').map((line, i) => (
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
          ) : (
            <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--txt-3)' }}>
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
          <span>/</span>
          <span style={{ color: '#fbbf24', opacity: 0.8 }}>index.html</span>
          {isLoading && (
            <span className="flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              <Loader2 className="w-2.5 h-2.5 animate-spin" /> 생성 중
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          {code && <span>{code.split('\n').length} lines</span>}
        </div>
      </div>
    </div>
  )
}