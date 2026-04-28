import { useState } from 'react'
import { ChevronDown, KeyRound, Check, X } from 'lucide-react'
import { cn } from '../lib/utils'
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
      <header className="flex items-center h-12 px-4 gap-3 flex-shrink-0 bg-zinc-900 border-b border-zinc-800 select-none">
        <div className="flex items-center gap-2.5 mr-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
            </svg>
          </div>
          <span className="font-semibold text-sm text-zinc-100 tracking-tight">Vibe Coding</span>
        </div>

        <div className="flex-1" />

        <div className="relative">
          <select
            value={model}
            onChange={e => onModelChange(e.target.value)}
            className="appearance-none h-8 pl-3 pr-7 text-xs rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-600 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
          >
            {MODELS.map(m => (
              <option key={m.id} value={m.id} className="bg-zinc-900">{m.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
        </div>

        <button
          onClick={isEnvKey ? undefined : openModal}
          className={cn(
            'flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-colors border',
            apiKey
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
              : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20',
            isEnvKey && 'cursor-default'
          )}
          title={isEnvKey ? '.env.local에서 로드됨' : 'API 키 설정'}
        >
          {apiKey
            ? <><Check className="w-3 h-3" /><span>API 로드됨</span></>
            : <><KeyRound className="w-3 h-3" /><span>API 키 없음</span></>}
        </button>
      </header>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-zinc-400" />
                <span className="font-semibold text-sm text-zinc-100">Groq API 키 설정</span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-zinc-500 mb-2">방법 1 (권장) — .env.local 파일에 저장</p>
                <div className="px-3 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-emerald-400">
                  VITE_GROQ_API_KEY=gsk_...
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-2">방법 2 — 직접 입력 (브라우저 로컬스토리지)</p>
                <input
                  type="password"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && save()}
                  placeholder="gsk-..."
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-950 border border-zinc-700 focus:border-blue-500 focus:outline-none text-sm font-mono text-zinc-200 placeholder:text-zinc-600 transition-colors"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
                >취소</button>
                <button
                  onClick={save}
                  className="px-4 py-2 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                >저장</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}