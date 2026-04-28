import { useState } from 'react'

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
    if (w) {
      w.document.write(html)
      w.document.close()
    }
  }

  return (
    <div className="flex flex-col flex-1 bg-gray-900 overflow-hidden min-w-0">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-gray-800 flex-shrink-0 bg-gray-900">
        <div className="flex gap-1">
          {(['preview', 'code'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                tab === t ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'preview' ? '🖥 미리보기' : '</> 코드'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {isLoading && (
            <span className="flex items-center gap-1.5 text-xs text-violet-400">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
              생성 중...
            </span>
          )}
          {code && tab === 'code' && (
            <button
              onClick={copyCode}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {copied ? '✅ 복사됨' : '📋 복사'}
            </button>
          )}
          {code && tab === 'preview' && (
            <button
              onClick={openInNewTab}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              ↗ 새 탭
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {/* Preview tab */}
        <div className={`absolute inset-0 ${tab === 'preview' ? 'flex' : 'hidden'} flex-col`}>
          {html ? (
            <iframe
              srcDoc={html}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
              title="Preview"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 text-gray-600">
              <div className="text-6xl opacity-20">🖥</div>
              <div>
                <p className="text-sm">왼쪽에서 프롬프트를 입력하면</p>
                <p className="text-sm">여기에 화면이 만들어집니다</p>
              </div>
            </div>
          )}
        </div>

        {/* Code tab */}
        <div className={`absolute inset-0 overflow-auto ${tab === 'code' ? 'block' : 'hidden'}`}>
          {code ? (
            <pre className="p-4 text-xs text-gray-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
              {code}
            </pre>
          ) : (
            <div className="flex-1 flex items-center justify-center h-full text-gray-600 text-sm">
              아직 생성된 코드가 없습니다
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
