import { useState } from 'react'
import logo from '../logo.png'
import { login } from '../services/chatStore'

interface Props {
  onLogin: () => void
}

/** 대화 저장소 접속 키 입력. 키는 운영자가 발급한다(worker/addkey.mjs). */
export default function LoginScreen({ onLogin }: Props) {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim()) return setError('접속 키를 입력하세요')
    setBusy(true)
    setError('')
    try {
      await login(key.trim())
      onLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : '접속하지 못했습니다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <form onSubmit={submit} className="w-full max-w-sm p-6 space-y-4"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
        <div className="flex items-center gap-2">
          <img src={logo} alt="" width={30} height={30} />
          <span style={{ fontFamily: 'var(--display-font)', fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--txt)' }}>Vibe Coding</span>
        </div>
        <label className="block space-y-1">
          <span style={{ color: 'var(--txt-2)', fontSize: 'var(--fs-sm)' }}>접속 키</span>
          <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="vk_..." autoComplete="current-password" autoFocus
            className="w-full px-3 py-2.5"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--txt)', fontSize: 'var(--fs-md)' }} />
        </label>
        {error && <p role="alert" style={{ color: 'var(--err)', fontSize: 'var(--fs-sm)' }}>{error}</p>}
        <button type="submit" disabled={busy} className="w-full py-2.5 font-medium"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-md)', opacity: busy ? 0.6 : 1 }}>
          {busy ? '확인 중…' : '접속'}
        </button>
      </form>
    </div>
  )
}
