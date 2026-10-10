import type { Message } from './ai'

/**
 * 대화 저장소 (Cloudflare Worker + R2, worker/ 참고)
 *
 * 대화 1건 = 메시지 + 그 대화에서 만든 프로젝트 파일. 접속 키별로 서버에 저장되어 다른 기기에서도 보인다.
 * 서버 주소는 빌드 시 VITE_CHAT_SERVER_URL 로 받는다. 접속 키는 localStorage 에 둔다.
 * 모든 함수는 실패 시(네트워크 오류, 서버 오류, 키 거부) reject 한다. 호출 측에서 사용자에게 알린다.
 */

export interface StoredChat {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: Message[]
  projectFiles: Record<string, string>
  projectType: 'html' | 'react' | 'vue'
  // 이 대화가 import·export 로 연결한 저장소. 이 필드가 생기기 전에 저장된 대화에는 없다.
  githubRepo?: GithubRepo | null
}

export type GithubRepo = { owner: string; repo: string; branch: string }

export type ChatSummary = Pick<StoredChat, 'id' | 'title' | 'updatedAt'>

const SERVER_URL = import.meta.env.VITE_CHAT_SERVER_URL
const KEY_STORAGE = 'vibe_chat_key'
/** 접속 키가 거부되면 window 에 이 이벤트를 보낸다. App 이 받아 접속 화면으로 돌린다. */
export const AUTH_EXPIRED_EVENT = 'chat-auth-expired'

export const hasKey = () => !!localStorage.getItem(KEY_STORAGE)

/** 404 는 호출 측이 판단하도록 그대로 돌려준다. 그 밖의 실패·네트워크 오류는 reject 한다. */
async function request(path: string, init: RequestInit = {}, key = localStorage.getItem(KEY_STORAGE) ?? ''): Promise<Response> {
  if (!SERVER_URL) throw new Error('VITE_CHAT_SERVER_URL 이 설정되지 않았습니다')
  const res = await fetch(`${SERVER_URL}/api${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${key}` } })
  if (res.status === 401) {
    localStorage.removeItem(KEY_STORAGE)
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
  }
  if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`)
  return res
}

/** 키를 서버에서 확인한 뒤에만 저장한다. */
export async function login(key: string): Promise<void> {
  const res = await request('/me', {}, key).catch((e) => {
    throw new Error(e.message === 'HTTP 401' ? '접속 키가 올바르지 않습니다' : '서버에 연결할 수 없습니다')
  })
  if (!res.ok) throw new Error('접속하지 못했습니다')
  localStorage.setItem(KEY_STORAGE, key)
}

/** 최근 수정 순 목록. 서버가 정렬해 준다. */
export async function listChats(): Promise<ChatSummary[]> {
  return (await request('/chats')).json()
}

export async function loadChat(id: string): Promise<StoredChat | undefined> {
  const res = await request(`/chats/${encodeURIComponent(id)}`)
  return res.status === 404 ? undefined : res.json()
}

export async function saveChat(chat: StoredChat): Promise<void> {
  await request(`/chats/${encodeURIComponent(chat.id)}`, {
    method: 'PUT',
    // 서버는 본문을 파싱하지 않으므로 목록용 제목·수정 시각을 헤더로 함께 보낸다.
    headers: { 'Content-Type': 'application/json', 'X-Chat-Title': encodeURIComponent(chat.title), 'X-Chat-Updated-At': String(chat.updatedAt) },
    body: JSON.stringify(chat),
  })
}

export async function deleteChat(id: string): Promise<void> {
  await request(`/chats/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** 첫 질문 앞부분을 제목으로 쓴다. */
export function chatTitle(messages: Message[]): string {
  const first = messages.find((m) => m.role === 'user')?.content.trim() ?? ''
  const line = first.split('\n')[0]
  return line.length > 40 ? `${line.slice(0, 40)}…` : line || '새 대화'
}
