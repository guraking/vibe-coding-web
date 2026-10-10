import type { Message } from './ai'

/**
 * 대화 저장소 (IndexedDB)
 *
 * 대화 1건 = 메시지 + 그 대화에서 만든 프로젝트 파일. 방문자 브라우저 안에만 저장된다.
 * GitHub Pages 에서는 같은 계정의 다른 저장소 사이트와 출처(guraking.github.io)를 공유하므로
 * DB 이름에 앱 접두어를 붙여 구분한다.
 * 모든 함수는 실패 시(시크릿 창, 용량 초과, IndexedDB 미지원) reject 한다. 호출 측에서 사용자에게 알린다.
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

const DB_NAME = 'vibe-coding-chats'
const DB_VERSION = 1
const STORE = 'chats'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' })
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    // 열기에 실패하면 다음 호출에서 다시 시도한다.
    dbPromise.catch(() => { dbPromise = null })
  }
  return dbPromise
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = action(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(request.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

/** 최근 수정 순 목록. */
export async function listChats(): Promise<ChatSummary[]> {
  // shortcut: 목록을 위해 메시지까지 모두 읽는다. 대화가 수백 건을 넘어 느려지면 updatedAt 인덱스 + 요약 전용 store 로 바꾼다.
  const all = await run('readonly', (store) => store.getAll() as IDBRequest<StoredChat[]>)
  return all
    .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadChat(id: string): Promise<StoredChat | undefined> {
  return run('readonly', (store) => store.get(id) as IDBRequest<StoredChat | undefined>)
}

export async function saveChat(chat: StoredChat): Promise<void> {
  await run('readwrite', (store) => store.put(chat))
}

export async function deleteChat(id: string): Promise<void> {
  await run('readwrite', (store) => store.delete(id))
}

/** 첫 질문 앞부분을 제목으로 쓴다. */
export function chatTitle(messages: Message[]): string {
  const first = messages.find((m) => m.role === 'user')?.content.trim() ?? ''
  const line = first.split('\n')[0]
  return line.length > 40 ? `${line.slice(0, 40)}…` : line || '새 대화'
}
