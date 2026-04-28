import { useState } from 'react'
import { GitFork, Loader2, X, ExternalLink, KeyRound } from 'lucide-react'
import { createRepoWithFiles } from '../services/github'

interface Props {
  files: Record<string, string>
  onClose: () => void
  onSuccess: (owner: string, repo: string, token: string) => void
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
      const cleanToken = token.trim()
      localStorage.setItem('vibe_gh_token', cleanToken)
      const { owner, repo } = await createRepoWithFiles(cleanToken, repoName.trim(), files)
      onSuccess(owner, repo, cleanToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
      setStatus('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-96 shadow-2xl flex flex-col gap-4"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: 24 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-s)' }}>
          <div className="flex items-center gap-2">
            <GitFork style={{ width: 14, height: 14, color: 'var(--accent)' }} />
            <span style={{ color: 'var(--txt)', fontFamily: 'var(--mono-font)', fontSize: 12, fontWeight: 600 }}>export to github</span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center transition-colors"
            style={{ width: 24, height: 24, color: 'var(--txt-3)', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--txt)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--txt-3)' }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Token */}
        <div className="flex flex-col gap-1.5">
          <label style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
            # github personal access token
          </label>
          <div className="flex items-center gap-2 px-3 py-2"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <KeyRound style={{ width: 12, height: 12, flexShrink: 0, color: 'var(--txt-3)' }} />
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              className="flex-1 bg-transparent outline-none"
              style={{ color: 'var(--txt)', fontFamily: 'var(--mono-font)', fontSize: 11 }}
            />
          </div>
          <a
            href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=VibeCoding"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1"
            style={{ color: 'var(--accent)', fontFamily: 'var(--mono-font)', fontSize: 10 }}
          >
            <ExternalLink style={{ width: 10, height: 10 }} /> create token with repo + workflow scope
          </a>
        </div>

        {/* Repo name */}
        <div className="flex flex-col gap-1.5">
          <label style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10 }}># repository name</label>
          <input
            type="text"
            value={repoName}
            onChange={e => setRepoName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, '-'))}
            className="px-3 py-2 outline-none"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--txt)', fontFamily: 'var(--mono-font)', fontSize: 11 }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent-bd)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* File count */}
        <div className="px-3 py-2" style={{ background: 'var(--bg)', color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
          {Object.keys(files).length} files: {Object.keys(files).join(', ')}
        </div>

        {error && (
          <p className="px-3 py-2" style={{ color: 'var(--err)', background: 'var(--err-bg)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
            {error}
          </p>
        )}

        <button
          onClick={handleExport}
          disabled={!token.trim() || !repoName.trim() || status === 'loading'}
          className="flex items-center justify-center gap-2 transition-opacity disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff', height: 36, fontFamily: 'var(--mono-font)', fontSize: 11, border: 'none', cursor: 'pointer' }}
        >
          {status === 'loading' ? (
            <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> creating repository...</>
          ) : (
            <><GitFork style={{ width: 14, height: 14 }} /> create repo &amp; export</>
          )}
        </button>
      </div>
    </div>
  )
}
