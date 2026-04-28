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
        className="flex items-center justify-between flex-shrink-0 select-none"
        style={{ height: 40, background: '#3c3f41', borderBottom: '1px solid #323232' }}
      >
        {/* Left: logo + project name */}
        <div className="flex items-center gap-0 h-full">
          <div
            className="flex items-center gap-2 px-4 h-full"
            style={{ borderRight: '1px solid #4a4a4a' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect width="18" height="18" rx="3" fill="#FE315D"/>
              <rect x="2" y="2" width="6" height="6" rx="1" fill="white"/>
              <rect x="10" y="2" width="6" height="6" rx="1" fill="white" opacity="0.7"/>
              <rect x="2" y="10" width="6" height="6" rx="1" fill="white" opacity="0.7"/>
              <rect x="10" y="10" width="6" height="6" rx="1" fill="#FE315D"/>
            </svg>
            <span style={{ color: '#bababa', fontWeight: 600, fontSize: 13, letterSpacing: 0.2 }}>
              Vibe Coding
            </span>
          </div>

          {/* Breadcrumb */}
          <div className="hidden sm:flex items-center gap-1.5 px-4 text-xs" style={{ color: '#606366' }}>
            <span style={{ color: '#a9b7c6' }}>vibe-coding-web</span>
            <span style={{ color: '#606366' }}>/</span>
            <span style={{ color: '#a9b7c6' }}>src</span>
            <span style={{ color: '#606366' }}>/</span>
            <span style={{ color: '#ffc66d' }}>App.tsx</span>
          </div>
        </div>

        {/* Right: model selector + API status */}
        <div className="flex items-center gap-2 px-3 h-full">
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="text-xs px-2.5 py-1 focus:outline-none cursor-pointer rounded"
            style={{
              background: '#4c5052',
              color: '#bababa',
              border: '1px solid #5c6164',
              height: 26,
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
            className="flex items-center gap-1.5 text-xs px-3 py-1 rounded transition-colors"
            style={{
              height: 26,
              background: apiKey ? 'rgba(73,156,84,0.2)' : 'rgba(255,107,104,0.2)',
              color: apiKey ? '#5aad63' : '#ff6b68',
              border: `1px solid ${apiKey ? 'rgba(73,156,84,0.4)' : 'rgba(255,107,104,0.4)'}`,
              cursor: isEnvKey ? 'default' : 'pointer',
            }}
            title={isEnvKey ? '.env.local에서 로드됨' : 'API 키 설정'}
          >
            <span style={{ fontSize: 9 }}>{apiKey ? '●' : '●'}</span>
            <span>{apiKey ? (isEnvKey ? '.env 로드됨' : 'API 연결됨') : 'API 키 없음'}</span>
          </button>
        </div>
      </header>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div
            className="w-full max-w-md shadow-2xl rounded"
            style={{ background: '#3c3f41', border: '1px solid #515151' }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: '#515151' }}
            >
              <span className="font-semibold text-sm" style={{ color: '#bababa' }}>
                Groq API 키 설정
              </span>
              <button
                onClick={() => setShowModal(false)}
                className="w-6 h-6 flex items-center justify-center rounded text-sm transition-colors"
                style={{ color: '#a9b7c6' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#4c5052')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                ×
              </button>
            </div>

            <div className="p-4">
              <p className="text-xs mb-1.5" style={{ color: '#808080' }}>
                방법 1 (권장) — .env.local 파일에 설정:
              </p>
              <div className="mb-4 px-3 py-2 text-xs rounded font-mono" style={{ background: '#2b2b2b', color: '#6a8759', border: '1px solid #515151' }}>
                VITE_GROQ_API_KEY=gsk_...
              </div>
              <p className="text-xs mb-2" style={{ color: '#808080' }}>
                방법 2 — 직접 입력 (브라우저에만 저장됩니다):
              </p>
              <input
                type="password"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                placeholder="gsk-..."
                autoFocus
                className="w-full px-3 py-2 text-sm rounded focus:outline-none mb-4 font-mono"
                style={{
                  background: '#2b2b2b',
                  border: '1px solid #4e9aea',
                  color: '#6a8759',
                }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-1.5 text-xs rounded transition-colors"
                  style={{ background: '#4c5052', color: '#a9b7c6', border: '1px solid #5c6164' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#5c6164')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#4c5052')}
                >
                  취소
                </button>
                <button
                  onClick={save}
                  className="px-4 py-1.5 text-xs rounded transition-colors"
                  style={{ background: '#4e9aea', color: '#fff' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#589df6')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#4e9aea')}
                >
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
