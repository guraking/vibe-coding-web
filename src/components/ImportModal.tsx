import { useRef, useState } from 'react'
import { FolderGit2, Loader2, X, KeyRound, ExternalLink } from 'lucide-react'
import { fetchRepoFiles, detectProjectType } from '../services/github'

/**
 * ImportModal 컴포넌트: GitHub 프로젝트 가져오기
 * 
 * 기능:
 * - GitHub 토큰 입력/저장
 * - 저장소 주소 입력 (owner/repo 형식)
 * - 선택 사항: 브랜치명 입력 (기본값: main)
 * - 저장소 파일 가져오기
 * - 프로젝트 타입 자동 감지 (HTML/React/Vue)
 * - 가져온 파일들을 메인 에디터로 로드
 */
interface Props {
  onClose: () => void
  onSuccess: (files: Record<string, string>, projectType: 'html' | 'react' | 'vue', owner: string, repo: string, branch: string) => void
}

export default function ImportModal({ onClose, onSuccess }: Props) {
  const [url, setUrl] = useState('')
  const [token, setToken] = useState(() => localStorage.getItem('vibe_gh_token') || '')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const backdropPressRef = useRef(false)

  const handleImport = async () => {
    if (!url.trim()) return
    setStatus('loading')
    setError('')
    setProgress('저장소 정보 가져오는 중...')
    try {
      if (token.trim()) localStorage.setItem('vibe_gh_token', token.trim())
      const { files, owner, repo, branch } = await fetchRepoFiles(url.trim(), token.trim() || undefined)
      setProgress(`${Object.keys(files).length}개 파일 로드 완료!`)
      const projectType = detectProjectType(files)
      onSuccess(files, projectType, owner, repo, branch)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
      setStatus('error')
      setProgress('')
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
        className="w-[420px] shadow-2xl flex flex-col gap-4"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: 24 }}
        onMouseDown={() => { backdropPressRef.current = false }}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-s)' }}>
          <div className="flex items-center gap-2">
            <FolderGit2 style={{ width: 14, height: 14, color: 'var(--accent)' }} />
            <span style={{ color: 'var(--txt)', fontFamily: 'var(--mono-font)', fontSize: 12, fontWeight: 600 }}>
              import from github
            </span>
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

        {/* URL */}
        <div className="flex flex-col gap-1.5">
          <label style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
            # github repository url
          </label>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleImport()}
            placeholder="https://github.com/owner/repo"
            autoFocus
            className="px-3 py-2 outline-none"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--accent-bd)',
              color: 'var(--txt)',
              caretColor: 'var(--accent)',
              fontFamily: 'var(--mono-font)',
              fontSize: 11,
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--accent-bd)')}
          />
          <p style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
            브랜치 지정: .../tree/branch-name
          </p>
        </div>

        {/* Token (optional) */}
        <div className="flex flex-col gap-1.5">
          <label style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
            # github token (비공개 저장소 또는 rate limit 방지용, 선택사항)
          </label>
          <div className="flex items-center gap-2 px-3 py-2"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <KeyRound style={{ width: 12, height: 12, flexShrink: 0, color: 'var(--txt-3)' }} />
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx (선택)"
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

        {/* Progress / Error */}
        {progress && status === 'loading' && (
          <div className="flex items-center gap-2 px-3 py-2"
            style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)', color: 'var(--accent)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
            <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
            {progress}
          </div>
        )}
        {error && (
          <p className="px-3 py-2 whitespace-pre-wrap"
            style={{ color: 'var(--err)', background: 'var(--err-bg)', border: '1px solid var(--err-bd)', fontFamily: 'var(--mono-font)', fontSize: 10 }}>
            {error}
          </p>
        )}

        {/* Button */}
        <button
          onClick={handleImport}
          disabled={!url.trim() || status === 'loading'}
          className="flex items-center justify-center gap-2 transition-opacity disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff', height: 36, fontFamily: 'var(--mono-font)', fontSize: 11, border: 'none', cursor: 'pointer' }}
        >
          {status === 'loading' ? (
            <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> 불러오는 중...</>
          ) : (
            <><FolderGit2 style={{ width: 14, height: 14 }} /> 불러오기</>
          )}
        </button>
      </div>
    </div>
  )
}
