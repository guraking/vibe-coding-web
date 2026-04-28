import { useState } from 'react'
import { ChevronDown, KeyRound, CheckCircle2, X, Zap } from 'lucide-react'
import { MODELS, PROVIDERS, getModelsByProvider } from '../services/ai'
import type { AIProvider } from '../services/ai'

interface Props {
  provider: AIProvider
  apiKeys: Record<AIProvider, string>
  model: string
  onProviderChange: (provider: AIProvider) => void
  onApiKeyChange: (provider: AIProvider, key: string) => void
  onModelChange: (provider: AIProvider, model: string) => void
  isEnvKeyByProvider: Record<AIProvider, boolean>
  isMobile?: boolean
}

const ENV_VAR_BY_PROVIDER: Record<AIProvider, string> = {
  groq: 'VITE_GROQ_API_KEY',
  openai: 'VITE_OPENAI_API_KEY',
  gemini: 'VITE_GEMINI_API_KEY',
}

const DOCS_BY_PROVIDER: Record<AIProvider, string> = {
  groq: 'https://console.groq.com/docs',
  openai: 'https://platform.openai.com/docs',
  gemini: 'https://ai.google.dev/gemini-api/docs',
}

export default function Header({ provider, apiKeys, model, onProviderChange, onApiKeyChange, onModelChange, isEnvKeyByProvider, isMobile }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [draft, setDraft] = useState<Record<AIProvider, string>>({ groq: '', openai: '', gemini: '' })

  const open = () => { setDraft(apiKeys); setShowModal(true) }
  const save = () => {
    (Object.keys(draft) as AIProvider[]).forEach((p) => onApiKeyChange(p, draft[p].trim()))
    setShowModal(false)
  }
  const reloadPage = () => window.location.reload()

  const selectedModel = MODELS.find(m => m.id === model)
  const providerModels = getModelsByProvider(provider)
  const hasActiveKey = !!apiKeys[provider]
  const isEnvActiveKey = isEnvKeyByProvider[provider]

  return (
    <>
      {/* Top bar */}
      <div className="flex-shrink-0 select-none" style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)' }}>
        {isMobile ? (
          /* Mobile: single compact row */
          <div className="flex items-center justify-between px-3" style={{ height: 48 }}>
            <button
              onClick={reloadPage}
              className="pixel-logo"
              style={{ fontSize: '12px', lineHeight: 1.4, background: 'transparent', border: 'none', color: 'var(--txt)', cursor: 'pointer' }}
            >
              VIBE
            </button>
            <div className="flex items-center gap-2">
              <select
                value={provider}
                onChange={e => onProviderChange(e.target.value as AIProvider)}
                className="appearance-none px-2 py-1 text-xs cursor-pointer focus:outline-none bg-transparent"
                style={{ color: 'var(--txt-2)', fontFamily: 'var(--mono-font)', border: '1px solid var(--border)', fontSize: 9 }}
              >
                {PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <select
                value={model}
                onChange={e => onModelChange(provider, e.target.value)}
                className="appearance-none px-2 py-1 text-xs cursor-pointer focus:outline-none bg-transparent"
                style={{ color: 'var(--txt-2)', fontFamily: 'var(--mono-font)', border: '1px solid var(--border)', fontSize: 9 }}
              >
                {providerModels.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <button
                onClick={open}
                className="badge transition-opacity"
                style={hasActiveKey
                  ? { background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', color: 'var(--ok)', cursor: 'pointer' }
                  : { background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err)', cursor: 'pointer' }
                }
              >
                {hasActiveKey
                  ? <><CheckCircle2 style={{ width: 9, height: 9 }} /><span>key ok</span></>
                  : <><KeyRound style={{ width: 9, height: 9 }} /><span>no key</span></>}
              </button>
            </div>
          </div>
        ) : (
          /* Desktop: full header */
          <>
            <div className="flex flex-col items-center justify-center py-4 gap-2">
          {/* Pixel logo */}
          <button
            onClick={reloadPage}
            className="pixel-logo"
            style={{ fontSize: '20px', lineHeight: 1.4, background: 'transparent', border: 'none', color: 'var(--txt)', cursor: 'pointer' }}
          >
            VIBE-CODING
          </button>
          {/* Subtitle */}
          <p style={{ color: 'var(--txt-3)', fontSize: '10px', fontFamily: 'var(--mono-font)', letterSpacing: '0.06em' }}>
            Build apps 10x faster with AI coding agents...
          </p>
          {/* Status badges row */}
          <div className="flex items-center gap-2 mt-1">
            <span className="badge" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-s)', color: 'var(--txt-2)' }}>
              {PROVIDERS.find((p) => p.id === provider)?.label ?? provider}
            </span>
            {/* Model badge */}
            <span className="badge" style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)', color: 'var(--accent)' }}>
              <Zap style={{ width: 9, height: 9 }} />
              {selectedModel?.label ?? model}
            </span>
            {/* API status badge */}
            <button
              onClick={open}
              className="badge transition-opacity"
              style={hasActiveKey
                ? { background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', color: 'var(--ok)', cursor: 'pointer' }
                : { background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err)', cursor: 'pointer' }
              }
              title={isEnvActiveKey ? '.env.local에서 로드됨' : 'API 키 설정'}
            >
              {hasActiveKey
                ? <><CheckCircle2 style={{ width: 9, height: 9 }} /><span>api key loaded</span></>
                : <><KeyRound style={{ width: 9, height: 9 }} /><span>api key not found</span></>}
            </button>
          </div>
        </div>

        {/* Nav bar */}
        <div className="flex items-center px-4 gap-1" style={{ borderTop: '1px solid var(--border-s)' }}>
          {/* Model selector nav-style */}
          <div className="relative flex items-center" style={{ borderRight: '1px solid var(--border-s)', paddingRight: 8, marginRight: 4 }}>
            <select
              value={provider}
              onChange={e => onProviderChange(e.target.value as AIProvider)}
              className="appearance-none h-9 pl-2 pr-8 text-xs cursor-pointer focus:outline-none transition-colors bg-transparent"
              style={{ color: 'var(--txt-2)', fontFamily: 'var(--mono-font)' }}
            >
              {PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: 'var(--txt-3)' }} />
          </div>

          <div className="relative flex items-center" style={{ borderRight: '1px solid var(--border-s)', paddingRight: 8, marginRight: 4 }}>
            <select
              value={model}
              onChange={e => onModelChange(provider, e.target.value)}
              className="appearance-none h-9 pl-2 pr-12 text-xs cursor-pointer focus:outline-none transition-colors bg-transparent"
              style={{ color: 'var(--txt-2)', fontFamily: 'var(--mono-font)' }}
            >
              {providerModels.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-9 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: 'var(--txt-3)' }} />
          </div>

          <NavItem label="Chat" active />
          <NavItem label="Docs" href={DOCS_BY_PROVIDER[provider]} />
        </div>
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="w-full max-w-md shadow-2xl overflow-hidden"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
            {/* Modal title bar */}
            <div className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              <div className="flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5" style={{ color: 'var(--txt-3)' }} />
                <span style={{ color: 'var(--txt)', fontFamily: 'var(--mono-font)', fontSize: 12, fontWeight: 600 }}>
                  AI API Key Settings
                </span>
              </div>
              <button onClick={() => setShowModal(false)}
                className="w-6 h-6 flex items-center justify-center transition-colors"
                style={{ color: 'var(--txt-3)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--txt)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--txt-3)' }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 11, marginBottom: 8 }}>
                  # 방법 1 (권장) — .env.local 파일에 저장
                </p>
                <div className="space-y-2">
                  {(Object.keys(ENV_VAR_BY_PROVIDER) as AIProvider[]).map((p) => (
                    <div key={p} className="px-3 py-2.5" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--ok)', fontFamily: 'var(--mono-font)', fontSize: 12 }}>
                      {ENV_VAR_BY_PROVIDER[p]}={p === 'gemini' ? 'AIza...' : 'sk-...'}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 11, marginBottom: 8 }}>
                  # 방법 2 — 직접 입력 (브라우저에 저장)
                </p>
                <div className="space-y-2">
                  {(Object.keys(draft) as AIProvider[]).map((p, idx) => (
                    <div key={p}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                        <span style={{ color: 'var(--txt-2)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
                          {PROVIDERS.find((item) => item.id === p)?.label}
                        </span>
                        {isEnvKeyByProvider[p] && (
                          <span style={{ color: 'var(--ok)', fontFamily: 'var(--mono-font)', fontSize: 9 }}>
                            .env.local 로드됨
                          </span>
                        )}
                      </div>
                      <input type="password" value={draft[p]}
                        onChange={e => setDraft((prev) => ({ ...prev, [p]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && save()}
                        placeholder={p === 'gemini' ? 'AIza...' : 'sk-...'}
                        autoFocus={idx === 0}
                        className="w-full px-3 py-2.5 focus:outline-none transition-colors"
                        style={{
                          background: 'var(--bg)',
                          border: '1px solid var(--accent-bd)',
                          color: 'var(--txt)',
                          caretColor: 'var(--accent)',
                          fontFamily: 'var(--mono-font)',
                          fontSize: 12,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => setShowModal(false)}
                  className="px-4 py-2 transition-colors"
                  style={{ background: 'var(--bg-card)', color: 'var(--txt-2)', border: '1px solid var(--border)', fontFamily: 'var(--mono-font)', fontSize: 11 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}>
                  cancel
                </button>
                <button onClick={save}
                  className="px-4 py-2 font-medium transition-colors"
                  style={{ background: 'var(--accent)', color: 'white', fontFamily: 'var(--mono-font)', fontSize: 11 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-h)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}>
                  save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function NavItem({ label, active, href, onClick }: { label: string; active?: boolean; href?: string; onClick?: () => void }) {
  const style: React.CSSProperties = {
    height: 36,
    padding: '0 12px',
    fontSize: 11,
    fontFamily: 'var(--mono-font)',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    color: active ? 'var(--txt)' : 'var(--txt-2)',
    transition: 'color 0.15s',
    display: 'inline-flex',
    alignItems: 'center',
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={style}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--txt)')}
        onMouseLeave={e => (e.currentTarget.style.color = active ? 'var(--txt)' : 'var(--txt-2)')}>
        {label}
      </a>
    )
  }
  return (
    <button style={style} onClick={onClick}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--txt)')}
      onMouseLeave={e => (e.currentTarget.style.color = active ? 'var(--txt)' : 'var(--txt-2)')}>
      {label}
    </button>
  )
}