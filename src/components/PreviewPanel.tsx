import { useState } from 'react'
import { Eye, Code2, Copy, Check, ExternalLink, Loader2, FileCode } from 'lucide-react'
import { cn } from '../lib/utils'

interface Props {
  html: string
  code: string
  isLoading: boolean
}

type Tab = 'preview' | 'code'

export default function PreviewPanel({ html, code, isLoading }: Props) {
  const [tab, setTab] = useState<Tab>('preview')
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openInNewTab = () => {
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-zinc-950">
      {/* Tab bar */}
      <div className="flex items-center h-11 px-2 gap-1 border-b border-zinc-800 bg-zinc-900 flex-shrink-0">
        <button
          onClick={() => setTab('preview')}
          className={cn(
            'flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-all',
            tab === 'preview'
              ? 'bg-zinc-800 text-zinc-200 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          )}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>미리보기</span>
          {isLoading && tab === 'preview' && (
            <Loader2 className="w-3 h-3 animate-spin text-blue-400 ml-1" />
          )}
        </button>

        <button
          onClick={() => setTab('code')}
          className={cn(
            'flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-all',
            tab === 'code'
              ? 'bg-zinc-800 text-zinc-200 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          )}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>코드</span>
        </button>

        <div className="flex-1" />

        {isLoading && (
          <div className="flex items-center gap-1.5 text-xs text-blue-400 mr-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            생성 중...
          </div>
        )}

        {code && tab === 'code' && (
          <button
            onClick={copyCode}
            className={cn(
              'flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs transition-all',
              copied
                ? 'text-emerald-400 bg-emerald-400/10'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            )}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '복사됨' : '복사'}</span>
          </button>
        )}

        {code && tab === 'preview' && (
          <button
            onClick={openInNewTab}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>새 탭</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Preview tab */}
        <div className={cn('absolute inset-0', tab === 'preview' ? 'flex flex-col' : 'hidden')}>
          {html ? (
            <iframe
              srcDoc={html}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
              title="Preview"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <FileCode className="w-7 h-7 text-zinc-600" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-sm font-semibold text-zinc-400">아직 생성된 화면이 없습니다</p>
                <p className="text-xs text-zinc-600">왼쪽 채팅에서 만들고 싶은 것을 설명하세요</p>
              </div>
              {/* Decorative code block */}
              <div className="px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-xs text-zinc-600 leading-relaxed">
                <div><span className="text-violet-400">const</span> <span className="text-blue-400">app</span> <span className="text-zinc-500">=</span> <span className="text-blue-400">await</span> <span className="text-emerald-400">vibeCode</span><span className="text-zinc-500">(</span><span className="text-amber-400">"your idea"</span><span className="text-zinc-500">)</span></div>
                <div><span className="text-blue-400">await</span> <span className="text-emerald-400">app.deploy</span><span className="text-zinc-500">()</span> <span className="text-zinc-700">// magic ✨</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Code tab */}
        <div className={cn('absolute inset-0 overflow-auto', tab === 'code' ? 'block' : 'hidden')}>
          {code ? (
            <table className="w-full border-collapse min-w-full">
              <tbody>
                {code.split('\n').map((line, i) => (
                  <tr key={i} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="text-right text-xs font-mono text-zinc-700 select-none align-top py-px pl-4 pr-4 border-r border-zinc-800/50 min-w-[3rem]">
                      {i + 1}
                    </td>
                    <td className="text-xs font-mono text-zinc-400 align-top py-px pl-4 pr-8 whitespace-pre-wrap break-all">
                      {line || ' '}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-zinc-600">
              아직 생성된 코드가 없습니다
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 h-6 bg-zinc-900 border-t border-zinc-800 flex-shrink-0 text-xs text-zinc-600 select-none">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">vibe-coding-web</span>
          <span>/</span>
          <span className="text-amber-500/80">index.html</span>
          {isLoading && <span className="text-blue-400 flex items-center gap-1"><Loader2 className="w-2.5 h-2.5 animate-spin" /> 생성 중</span>}
        </div>
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          {code && <span>{code.split('\n').length} lines</span>}
        </div>
      </div>
    </div>
  )
}