import { useState } from 'react'
import { MODELS } from '../services/ai'

interface Props {
  apiKey: string
  model: string
  onApiKeyChange: (key: string) => void
  onModelChange: (model: string) => void
}

export default function Header({ apiKey, model, onApiKeyChange, onModelChange }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [draft, setDraft] = useState('')

  const openModal = () => {
    setDraft(apiKey)
    setShowModal(true)
  }

  const save = () => {
    onApiKeyChange(draft.trim())
    setShowModal(false)
  }

  return (
    <>
      {/* VS Code Title Bar */}
      <header
        className="flex items-center justify-between px-3 flex-shrink-0 z-10 select-none"
        style={{ height: 30, background: '#3c3c3c', borderBottom: '1px solid #252526' }}
      >
        {/* Left: traffic lights area (decorative on Windows) + app name */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 mr-1">
            <span className="w-3 h-3 rounded-full bg-[#ff5f56] opacity-80" />
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e] opacity-80" />
            <span className="w-3 h-3 rounded-full bg-[#27c93f] opacity-80" />
          </div>
          <span className="text-[#cccccc] text-xs font-medium tracking-wide">
            ⚡ Vibe Coding
          </span>
        </div>

        {/* Center: file breadcrumb style */}
        <div className="hidden sm:flex items-center gap-1 text-xs text-[#858585]">
          <span>vibe-coding-web</span>
          <span className="text-[#555]">›</span>
          <span className="text-[#cccccc]">src</span>
          <span className="text-[#555]">›</span>
          <span style={{ color: '#ce9178' }}>App.tsx</span>
        </div>

        {/* Right: model + API key */}
        <div className="flex items-center gap-2">
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="text-xs px-2 py-0.5 focus:outline-none cursor-pointer"
            style={{ background: '#3c3c3c', color: '#cccccc', border: 'none' }}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id} style={{ background: '#252526' }}>
                {m.label}
              </option>
            ))}
          </select>

          <button
            onClick={openModal}
            className="flex items-center gap-1 text-xs px-2.5 py-0.5 transition-colors"
            style={{
              background: apiKey ? 'rgba(78,201,176,0.15)' : 'rgba(244,71,71,0.15)',
              color: apiKey ? '#4ec9b0' : '#f44747',
              border: `1px solid ${apiKey ? '#4ec9b040' : '#f4474740'}`,
            }}
          >
            <span>{apiKey ? '●' : '○'}</span>
            <span>{apiKey ? 'API 연결됨' : 'API 키 없음'}</span>
          </button>
        </div>
      </header>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div
            className="w-full max-w-md shadow-2xl"
            style={{ background: '#252526', border: '1px solid #3c3c3c' }}
          >
            {/* Modal title bar */}
            <div
              className="flex items-center justify-between px-4 py-2.5 border-b"
              style={{ borderColor: '#3c3c3c' }}
            >
              <span className="text-sm font-medium" style={{ color: '#cccccc' }}>
                OpenAI API 키 설정
              </span>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#858585] hover:text-white text-lg leading-none transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-4">
              <p className="text-xs mb-3" style={{ color: '#6a9955' }}>
                {/* VS Code comment style */}
                {'// 키는 브라우저 localStorage에만 저장됩니다.'}
              </p>
              <input
                type="password"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                placeholder="sk-..."
                autoFocus
                className="w-full px-3 py-2 text-sm font-code focus:outline-none mb-4"
                style={{
                  background: '#1e1e1e',
                  border: '1px solid #007acc',
                  color: '#ce9178',
                }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-1.5 text-xs transition-colors"
                  style={{ color: '#858585' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#cccccc')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#858585')}
                >
                  취소
                </button>
                <button
                  onClick={save}
                  className="px-4 py-1.5 text-xs transition-colors"
                  style={{ background: '#007acc', color: '#ffffff' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1177bb')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#007acc')}
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
