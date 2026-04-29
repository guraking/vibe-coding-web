/**
 * GitHub 저장소 낵보내 모달 컴포넌트
 * 기존 저장소 업데이트 또는 새 저장소 생성
 */

import { useRef, useState } from 'react'
import { GitFork, Loader2, X, ExternalLink, KeyRound } from 'lucide-react'  // UI 아이콘
import { createRepoWithFiles, updateRepoWithFiles } from '../services/github'  // GitHub API

/**
 * ExportModal Props 인터페이스
 */
interface Props {
  files: Record<string, string>  // 낵보내들 파일들
  githubRepo?: { owner: string; repo: string; branch: string } | null  // 기존 GitHub 저장소 (선택)
  onClose: () => void  // 모달 닫기 콜백
  onSuccess: (owner: string, repo: string, branch: string, token: string) => void  // 낵보내기 성공 콜백
}

function loadPersistedRepo(): { owner: string; repo: string; branch: string } | null {
  // Try both the primary key and the deploy-history to find a known repo
  const KEYS = ['vibe_github_repo']
  for (const key of KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as { owner?: string; repo?: string; branch?: string }
      if (parsed?.owner && parsed?.repo) {
        return { owner: parsed.owner, repo: parsed.repo, branch: parsed.branch || 'main' }
      }
    } catch { /* skip */ }
  }
  // Fall back to the most recent deploy history entry
  try {
    const raw = localStorage.getItem('vibe_deploy_history')
    if (raw) {
      const history = JSON.parse(raw) as Array<{ owner?: string; repo?: string; branch?: string; deployedAt?: number }>
      if (Array.isArray(history) && history.length > 0) {
        const latest = history.sort((a, b) => (b.deployedAt ?? 0) - (a.deployedAt ?? 0))[0]
        if (latest?.owner && latest?.repo) {
          return { owner: latest.owner, repo: latest.repo, branch: latest.branch || 'main' }
        }
      }
    }
  } catch { /* skip */ }
  return null
}

export default function ExportModal({ files, githubRepo: githubRepoProp, onClose, onSuccess }: Props) {
  // Explicit prop takes priority, then fall back to any persisted value
  const resolvedRepo = githubRepoProp ?? loadPersistedRepo()
  const [useExisting, setUseExisting] = useState(!!resolvedRepo)
  const githubRepo = useExisting ? resolvedRepo : null
  const [token, setToken] = useState(() => localStorage.getItem('vibe_gh_token') || '')
  // When an existing repo is detected, pre-fill its name to avoid accidental new-name collision
  const [repoName, setRepoName] = useState(() =>
    resolvedRepo ? resolvedRepo.repo : 'vibe-app-' + Date.now().toString(36)
  )
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const canExport = !!token.trim() && (githubRepo ? true : !!repoName.trim())
  const backdropPressRef = useRef(false)

  const handleExport = async () => {
    if (!canExport || status === 'loading') return
    setStatus('loading')
    setError('')
    try {
      const cleanToken = token.trim()
      localStorage.setItem('vibe_gh_token', cleanToken)
      if (githubRepo) {
        const { owner, repo, branch } = await updateRepoWithFiles(
          cleanToken,
          githubRepo.owner,
          githubRepo.repo,
          githubRepo.branch,
          files,
        )
        // Persist immediately so next open defaults to update mode
        localStorage.setItem('vibe_github_repo', JSON.stringify({ owner, repo, branch }))
        onSuccess(owner, repo, branch, cleanToken)
      } else {
        const { owner, repo, branch } = await createRepoWithFiles(cleanToken, repoName.trim(), files)
        // Persist immediately so next open defaults to update mode
        localStorage.setItem('vibe_github_repo', JSON.stringify({ owner, repo, branch }))
        onSuccess(owner, repo, branch, cleanToken)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
      setStatus('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onMouseDown={e => { backdropPressRef.current = e.target === e.currentTarget }}
      onMouseUp={e => {
        if (backdropPressRef.current && e.target === e.currentTarget) onClose()
        backdropPressRef.current = false
      }}
      onMouseLeave={() => { backdropPressRef.current = false }}
    >
      <div
        className="w-96 shadow-2xl flex flex-col gap-4"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: 24 }}
        onMouseDown={() => { backdropPressRef.current = false }}
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

        {/* Repo target */}
        {resolvedRepo ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10 }}># target repository</label>
              <button
                onClick={() => setUseExisting(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10 }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt-3)' }}
              >
                {useExisting ? '+ 새 저장소 만들기' : '← 기존 저장소 사용'}
              </button>
            </div>
            {useExisting ? (
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{ background: 'var(--bg)', border: '1px solid var(--ok-bd)', color: 'var(--txt)', fontFamily: 'var(--mono-font)', fontSize: 11 }}
              >
                <GitFork style={{ width: 11, height: 11, color: 'var(--ok)', flexShrink: 0 }} />
                <span>{resolvedRepo.owner}/{resolvedRepo.repo}</span>
                <span style={{ color: 'var(--txt-3)', fontSize: 10 }}>({resolvedRepo.branch})</span>
              </div>
            ) : (
              <input
                type="text"
                value={repoName}
                onChange={e => setRepoName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, '-'))}
                className="px-3 py-2 outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--txt)', fontFamily: 'var(--mono-font)', fontSize: 11 }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent-bd)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            )}
          </div>
        ) : (
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
        )}

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
          disabled={!canExport || status === 'loading'}
          className="flex items-center justify-center gap-2 transition-opacity disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff', height: 36, fontFamily: 'var(--mono-font)', fontSize: 11, border: 'none', cursor: 'pointer' }}
        >
          {status === 'loading' ? (
            <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> {githubRepo ? 'updating repository...' : 'creating repository...'}</>
          ) : (
            <><GitFork style={{ width: 14, height: 14 }} /> {githubRepo ? `push to ${resolvedRepo?.owner}/${resolvedRepo?.repo}` : 'create repo & export'}</>
          )}
        </button>
      </div>
    </div>
  )
}
