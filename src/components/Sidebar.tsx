import { Plus, Trash2, MessageSquare, PanelLeft } from 'lucide-react'
import type { ChatSummary } from '../services/chatStore'

/**
 * Sidebar: 저장된 대화 목록
 *
 * 최근 수정 순으로 오늘 / 어제 / 지난 7일 / 이전 묶음으로 보여준다.
 * 응답 생성 중(busy)에는 대화 전환·새 대화·삭제를 막는다. 진행 중인 스트림이 다른 대화에 섞이지 않게 하기 위함이다.
 */
interface Props {
  chats: ChatSummary[]
  activeId: string | null
  busy: boolean
  error: string
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onClose: () => void
}

const DAY_MS = 24 * 60 * 60 * 1000

function groupLabel(updatedAt: number, todayStart: number): string {
  if (updatedAt >= todayStart) return '오늘'
  if (updatedAt >= todayStart - DAY_MS) return '어제'
  if (updatedAt >= todayStart - 7 * DAY_MS) return '지난 7일'
  return '이전'
}

export default function Sidebar({ chats, activeId, busy, error, onSelect, onNew, onDelete, onClose }: Props) {
  const todayStart = new Date().setHours(0, 0, 0, 0)
  const groups: { label: string; items: ChatSummary[] }[] = []
  for (const chat of chats) {
    const label = groupLabel(chat.updatedAt, todayStart)
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(chat)
    else groups.push({ label, items: [chat] })
  }

  return (
    <nav aria-label="대화 목록" className="sidebar flex flex-col h-full">
      <div className="p-3 flex-shrink-0 flex items-center gap-2">
        <button onClick={onNew} disabled={busy} className="sidebar-new">
          <Plus style={{ width: 16, height: 16 }} />
          <span>새 대화</span>
        </button>
        <button onClick={onClose} className="icon-btn" aria-label="대화 목록 접기" aria-expanded>
          <PanelLeft style={{ width: 18, height: 18 }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {chats.length === 0 && (
          <p style={{ color: 'var(--txt-3)', fontSize: 'var(--fs-sm)', padding: '8px 10px' }}>
            저장된 대화가 없습니다
          </p>
        )}
        {groups.map((group) => (
          <section key={group.label} className="mb-3">
            <h2 className="sidebar-group">{group.label}</h2>
            <ul>
              {group.items.map((chat) => (
                <li key={chat.id} className="sidebar-item" data-active={chat.id === activeId}>
                  <button onClick={() => onSelect(chat.id)} disabled={busy} className="sidebar-item-open" title={chat.title}>
                    <MessageSquare aria-hidden="true" style={{ width: 14, height: 14, flexShrink: 0 }} />
                    <span className="truncate">{chat.title}</span>
                  </button>
                  <button onClick={() => onDelete(chat.id)} disabled={busy} className="sidebar-item-delete" aria-label={`${chat.title} 삭제`}>
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {error && (
        <p role="alert" className="flex-shrink-0" style={{ color: 'var(--err)', fontSize: 'var(--fs-xs)', padding: '8px 14px', borderTop: '1px solid var(--border)' }}>
          {error}
        </p>
      )}
    </nav>
  )
}
