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
      <header className="flex items-center justify-between px-4 h-12 bg-gray-900 border-b border-gray-800 flex-shrink-0 z-10">
        <span className="text-base font-bold bg-gradient-to-r from-violet-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent select-none">
          ⚡ Vibe Coding
        </span>

        <div className="flex items-center gap-3">
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-violet-500 cursor-pointer"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          <button
            onClick={openModal}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-all ${
              apiKey
                ? 'border-emerald-700 bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50'
                : 'border-red-700 bg-red-900/30 text-red-400 hover:bg-red-900/50 animate-pulse'
            }`}
          >
            {apiKey ? '🔑 API 키 설정됨' : '⚠️ API 키 필요'}
          </button>
        </div>
      </header>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-white font-bold text-lg mb-1">OpenAI API 키 설정</h2>
            <p className="text-gray-400 text-sm mb-4">
              키는 브라우저 localStorage에만 저장됩니다. 서버로 전송되지 않습니다.
            </p>
            <input
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="sk-..."
              autoFocus
              className="w-full bg-gray-800 border border-gray-600 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 mb-4 font-mono placeholder-gray-600"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                취소
              </button>
              <button
                onClick={save}
                className="px-5 py-2 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors font-medium"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
