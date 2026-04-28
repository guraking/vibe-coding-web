import { useState } from 'react'
import { ChevronDown, KeyRound, CheckCircle2, X } from 'lucide-react'
import { MODELS } from '../services/ai'

interface Props {
  apiKey: string
  model: string
  onApiKeyChange: (key: string) => void
  onModelChange: (model: string) => void
  isEnvKey?: boolean
}

export default function Header({ apiKey, model, onApiKeyChange, onModelChange, isEnvKey }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [draft, setDraft] = useState('')

  const open = () => { setDraft(apiKey); setShowModal(true) }
  const save = () => { onApiKeyChange(draft.trim()); setShowModal(false) }

  return (
    <>
      <header className="flex items-center h-12 px-4 gap-3 flex-shrink-0 select-none"
        style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)' }}>

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
            </svg>
          </div>
          <span className="font-semibold text-sm tracking-tight" style={{ color: 'var(--txt)' }}>
            Vibe Coding
          </span>
        </div>

        <div className="flex-1" />

        {/* Model selector */}
        <div className="relative">
          <select
            value={model}
            onChange={e => onModelChange(e.target.value)}
            className="appearance-none h-8 pl-3 pr-7 text-xs rounded-lg cursor-pointer focus:outline-none transition-colors"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--txt-2)',
            }}
          >
            {MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: 'var(--txt-3)' }} />
        </div>

        {/* API status */}
        <button
          onClick={isEnvKey ? undefined : open}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors"
          style={apiKey
            ? { background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', color: 'var(--ok)', cursor: isEnvKey ? 'default' : 'pointer' }
            : { background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err)', cursor: 'pointer' }
          }
          title={isEnvKey ? '.env.local에서 로드됨' : 'API 키 설정'}
        >
          {apiKey
            ? <><CheckCircle2 className="w-3.5 h-3.5" /><span>API 로드됨</span></>
            : <><KeyRound className="w-3.5 h-3.5" /><span>API 키 없음</span></>}
        </button>
      </header>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4" style={{ color: 'var(--txt-2)' }} />
                <span className="font-semibold text-sm" style={{ color: 'var(--txt)' }}>Groq API 키 설정</span>
              </div>
              <button onClick={() => setShowModal(false)}
                className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
                style={{ color: 'var(--txt-3)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--txt)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--txt-3)' }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs mb-2" style={{ color: 'var(--txt-3)' }}>방법 1 (권장) — .env.local 파일에 저장</p>
                <div className="px-3 py-2.5 rounded-lg font-mono text-xs" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--ok)' }}>
                  VITE_GROQ_API_KEY=gsk_...
                </div>
              </div>
              <div>
                <p className="text-xs mb-2" style={{ color: 'var(--txt-3)' }}>방법 2 — 직접 입력 (브라우저에 저장)</p>
                <input type="password" value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && save()}
                  placeholder="gsk-..." autoFocus
                  className="w-full px-3 py-2.5 rounded-lg text-sm font-mono focus:outline-none transition-colors"
                  style={{ background: 'var(--bg)', border: '1px solid var(--accent-bd)', color: 'var(--txt)', caretColor: 'var(--accent)' }}
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs rounded-lg transition-colors"
                  style={{ background: 'var(--bg-card)', color: 'var(--txt-2)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}>
                  취소
                </button>
                <button onClick={save}
                  className="px-4 py-2 text-xs rounded-lg font-medium transition-colors"
                  style={{ background: 'var(--accent)', color: 'white' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-h)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}>
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}