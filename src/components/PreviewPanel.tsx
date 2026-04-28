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
    <div className="flex flex-col flex-1 overflow-hidden min-w-0" style={{ background: '#1e1e1e' }}>
      <div className="flex items-end flex-shrink-0" style={{ background: '#2d2d2d', borderBottom: '1px solid #252526', height: 36 }}>
        <button onClick={() => setTab('preview')} className="relative flex items-center gap-2 px-4 h-full text-xs transition-colors select-none" style={{ background: tab === 'preview' ? '#1e1e1e' : 'transparent', color: tab === 'preview' ? '#cccccc' : '#858585', borderRight: '1px solid #252526', borderTop: tab === 'preview' ? '1px solid #007acc' : '1px solid transparent' }}>
          <span style={{ color: '#519aba', fontSize: 11 }}>⬡</span>
          <span>index.html</span>
          {isLoading && tab === 'preview' && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#007acc' }} />}
        </button>
        <button onClick={() => setTab('code')} className="relative flex items-center gap-2 px-4 h-full text-xs transition-colors select-none" style={{ background: tab === 'code' ? '#1e1e1e' : 'transparent', color: tab === 'code' ? '#cccccc' : '#858585', borderRight: '1px solid #252526', borderTop: tab === 'code' ? '1px solid #007acc' : '1px solid transparent' }}>
          <span style={{ color: '#f1e05a', fontSize: 11 }}>⬡</span>
          <span>output.tsx</span>
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-3 px-3 h-full">
          {isLoading && <span className="flex items-center gap-1.5 text-xs" style={{ color: '#007acc' }}><span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: '#007acc' }} />생성 중...</span>}
          {code && tab === 'code' && <button onClick={copyCode} className="text-xs transition-colors" style={{ color: copied ? '#4ec9b0' : '#858585' }} onMouseEnter={e => (e.currentTarget.style.color = '#cccccc')} onMouseLeave={e => (e.currentTarget.style.color = copied ? '#4ec9b0' : '#858585')}>{copied ? '✓ 복사됨' : '복사'}</button>}
          {code && tab === 'preview' && <button onClick={openInNewTab} className="text-xs transition-colors" style={{ color: '#858585' }} onMouseEnter={e => (e.currentTarget.style.color = '#cccccc')} onMouseLeave={e => (e.currentTarget.style.color = '#858585')}>↗ 새 탭</button>}
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 flex flex-col ${tab === 'preview' ? '' : 'hidden'}`}>
          {html ? (
            <iframe srcDoc={html} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups" title="Preview" />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              <div className="text-center">
                <div className="text-5xl mb-4 font-mono" style={{ color: '#2a2a2a' }}>{"{ }"}</div>
                <p className="text-sm" style={{ color: '#555' }}>왼쪽 채팅에서 프롬프트를 입력하면</p>
                <p className="text-sm" style={{ color: '#555' }}>여기에 결과물이 렌더링됩니다</p>
                <p className="text-xs mt-3" style={{ color: '#3c3c3c' }}>Powered by OpenAI · Vibe Coding</p>
              </div>
              <div className="font-mono text-xs" style={{ color: '#2d2d2d' }}>
                {['1  import React from "react"', '2  ', '3  export default function App() {', '4    return (', '5      // 아직 생성된 컴포넌트가 없습니다', '6    )', '7  }'].map((line, i) => (<div key={i} className="leading-relaxed">{line}</div>))}
              </div>
            </div>
          )}
        </div>
        <div className={`absolute inset-0 overflow-auto ${tab === 'code' ? 'block' : 'hidden'}`} style={{ background: '#1e1e1e' }}>
          {code ? (
            <table className="w-full border-collapse">
              <tbody>
                {code.split('\n').map((line, i) => (
                  <tr key={i} className="leading-5 hover:bg-white/[0.03] transition-colors">
                    <td className="text-right px-4 select-none align-top text-xs" style={{ color: '#858585', minWidth: 48, paddingTop: 1, paddingBottom: 1 }}>{i + 1}</td>
                    <td className="pr-4 text-xs align-top whitespace-pre-wrap break-words font-mono" style={{ color: '#d4d4d4', paddingTop: 1, paddingBottom: 1 }}>{line || ' '}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex items-center justify-center h-full text-xs" style={{ color: '#555' }}>아직 생성된 코드가 없습니다</div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between px-3 flex-shrink-0 text-xs select-none" style={{ height: 22, background: '#007acc', color: 'rgba(255,255,255,0.9)' }}>
        <div className="flex items-center gap-3"><span>⚡ Vibe Coding</span>{isLoading && <span className="opacity-80">● AI 생성 중...</span>}</div>
        <div className="flex items-center gap-3 opacity-80"><span>UTF-8</span><span>HTML</span>{code && <span>Ln 1, Col 1</span>}</div>
      </div>
    </div>
  )
}
