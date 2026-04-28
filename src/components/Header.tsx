import { useState } from 'react'
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

  const openModal = () => { setDraft(apiKey); setShowModal(true) }
  const save = () => { onApiKeyChange(draft.trim()); setShowModal(false) }

  return (
    <>
      <header
        className="flex items-center flex-shrink-0 select-none"
        style={{ height: 40, background: '#3c3f41', borderBottom: '1px solid #282828' }}
      >
        {/* Left: traffic lights + logo */}
        <div className="flex items-center gap-3 px-3" style={{ minWidth: 0 }}>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
          </div>
        </div>

        {/* Center: branch + project name */}
        <div className="flex-1 flex items-center justify-center gap-0">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs"
            style={{ color: '#9da4ac', background: '#2b2d30', border: '1px solid #43454a', maxWidth: 260 }}
          >
            {/* git icon */}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9da4ac" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
              <path d="M6 9v6M18 15v-3a3 3 0 0 0-3-3H9"/>
            </svg>
            <span style={{ color: '#bababa' }}>main</span>
            <span style={{ color: '#606366', margin: '0 2px' }}>·</span>
            <span style={{ color: '#9da4ac' }}>vibe-coding-web</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="#606366" style={{ marginLeft: 2 }}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="#606366" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* Right: model + API status */}
        <div className="flex items-center gap-1.5 px-2" style={{ minWidth: 0 }}>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="text-xs focus:outline-none cursor-pointer rounded px-2"
            style={{
              background: '#2b2d30',
              color: '#9da4ac',
              border: '1px solid #43454a',
              height: 26,
              maxWidth: 140,
            }}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id} style={{ background: '#3c3f41' }}>
                {m.label}
              </option>
            ))}
          </select>

          <button
            onClick={isEnvKey ? undefined : openModal}
            className="flex items-center gap-1.5 text-xs px-3 rounded font-medium transition-colors"
            style={{
              height: 26,
              background: apiKey ? '#214283' : 'rgba(255,107,104,0.18)',
              color: apiKey ? '#6cace4' : '#ff6b68',
              border: `1px solid ${apiKey ? '#2d5c99' : 'rgba(255,107,104,0.4)'}`,
              cursor: isEnvKey ? 'default' : 'pointer',
            }}
            title={isEnvKey ? '.env.local에서 로드됨' : 'API 키 설정'}
            onMouseEnter={e => { if (!isEnvKey && apiKey) e.currentTarget.style.background = '#2d5c99' }}
            onMouseLeave={e => { if (!isEnvKey && apiKey) e.currentTarget.style.background = '#214283' }}
          >
            <span style={{ fontSize: 8, lineHeight: 1 }}>▶</span>
            <span>{apiKey ? 'API 로드됨' : 'API 키 없음'}</span>
          </button>
        </div>
      </header>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div
            className="w-full max-w-md shadow-2xl rounded"
            style={{ background: '#2b2d30', border: '1px solid #43454a' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#43454a' }}>
              <span className="font-semibold text-sm" style={{ color: '#bababa' }}>Groq API 키 설정</span>
              <button
                onClick={() => setShowModal(false)}
                className="w-6 h-6 flex items-center justify-center rounded text-sm transition-colors"
                style={{ color: '#9da4ac' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#43454a')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >×</button>
            </div>
            <div className="p-4">
              <p className="text-xs mb-1.5" style={{ color: '#606366' }}>방법 1 (권장) — .env.local 파일에 설정:</p>
              <div className="mb-4 px-3 py-2 text-xs rounded font-mono" style={{ background: '#1e1f22', color: '#6a8759', border: '1px solid #43454a' }}>
                VITE_GROQ_API_KEY=gsk_...
              </div>
              <p className="text-xs mb-2" style={{ color: '#606366' }}>방법 2 — 직접 입력 (브라우저에만 저장됩니다):</p>
              <input
                type="password"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                placeholder="gsk-..."
                autoFocus
                className="w-full px-3 py-2 text-sm rounded focus:outline-none mb-4 font-mono"
                style={{ background: '#1e1f22', border: '1px solid #4e9aea', color: '#6a8759' }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-1.5 text-xs rounded transition-colors"
                  style={{ background: '#43454a', color: '#9da4ac', border: '1px solid #5c6164' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#5c6164')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#43454a')}
                >취소</button>
                <button
                  onClick={save}
                  className="px-4 py-1.5 text-xs rounded transition-colors"
                  style={{ background: '#4e9aea', color: '#fff' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#589df6')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#4e9aea')}
                >저장</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}