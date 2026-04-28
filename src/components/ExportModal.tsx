import { useState } from 'react'
import { GitFork, Loader2, X, ExternalLink, KeyRound } from 'lucide-react'
import { createRepoWithFiles } from '../services/github'

interface Props {
  files: Record<string, string>
  onClose: () => void
  onSuccess: (owner: string, repo: string) => void
}

export default function ExportModal({ files, onClose, onSuccess }: Props) {
  const [token, setToken] = useState(() => localStorage.getItem('vibe_gh_token') || '')
  const [repoName, setRepoName] = useState('vibe-app-' + Date.now().toString(36))
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')

  const handleExport = async () => {
    if (!token.trim() || !repoName.trim()) return
    setStatus('loading')
    setError('')
    try {
      localStorage.setItem('vibe_gh_token', token.trim())
      const { owner, repo } = await createRepoWithFiles(token.trim(), repoName.trim(), files)
      onSuccess(owner, repo)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
      setStatus('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-96 rounded-2xl p-6 shadow-2xl flex flex-col gap-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitFork className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <span className="font-semibold text-sm" style={{ color: 'var(--txt)' }}>GitHub에 내보내기</span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--txt-3)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Token */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--txt-3)' }}>
            GitHub Personal Access Token
          </label>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <KeyRound className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--txt-3)' }} />
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--txt)' }}
            />
          </div>
          <a
            href="https://github.com/settings/tokens/new?scopes=repo&description=VibeCoding"
            target="_blank"
            rel="noreferrer"
            className="text-xs flex items-center gap-1"
            style={{ color: 'var(--accent)' }}
          >
            <ExternalLink className="w-3 h-3" /> repo 권한으로 토큰 생성하기
          </a>
        </div>

        {/* Repo name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--txt-3)' }}>저장소 이름</label>
          <input
            type="text"
            value={repoName}
            onChange={e => setRepoName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, '-'))}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--txt)' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent-bd)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* File count */}
        <div className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--bg)', color: 'var(--txt-3)' }}>
          {Object.keys(files).length}개 파일 내보내기: {Object.keys(files).join(', ')}
        </div>

        {error && (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ color: 'var(--err)', background: 'var(--err-bg)' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleExport}
          disabled={!token.trim() || !repoName.trim() || status === 'loading'}
          className="flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-medium transition-opacity disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {status === 'loading' ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> 저장소 생성 중...</>
          ) : (
            <><GitFork className="w-4 h-4" /> 저장소 생성 &amp; 내보내기</>
          )}
        </button>
      </div>
    </div>
  )
}
