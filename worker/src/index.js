/**
 * 대화 저장 API (Cloudflare Worker + R2)
 *
 * GET    /api/me             → { user }  접속 키 확인
 * GET    /api/chats          → ChatSummary[] (최근 수정 순)
 * GET    /api/chats/:id      → StoredChat JSON | 404
 * PUT    /api/chats/:id      본문 = StoredChat JSON, 헤더 X-Chat-Title(URI 인코딩)·X-Chat-Updated-At
 * DELETE /api/chats/:id
 *
 * 인증: Authorization: Bearer <접속 키>. R2 의 keys/<sha256(키)> 객체 본문이 사용자 이름이다.
 * 키는 256비트 무작위라 느린 해시나 시도 횟수 제한 없이 SHA-256 만으로 충분하다.
 *
 * 무료 요금제는 요청당 CPU 10ms 이므로 대화 본문은 파싱하지 않고 R2 로 그대로 흘려보낸다.
 * 목록에 필요한 제목·수정 시각은 R2 customMetadata 에 따로 둬서 목록 조회 때 본문을 열지 않는다.
 */

const NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/
// crypto.randomUUID() 형식을 포함한다. 경로 문자('/', '.')는 허용하지 않는다.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
// 대화에는 base64 이미지가 들어간다. 무료 요금제 요청 크기 한도(100MB)보다 작게 둔다.
const MAX_BODY_BYTES = 50 * 1024 * 1024
// R2 customMetadata 는 키·값 합계 2KB 까지다. 제목은 이 길이에서 자른다.
const MAX_TITLE_LENGTH = 200

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 접속 키에 해당하는 사용자 이름. 키가 없거나 틀리면 null. */
async function authenticate(request, env) {
  const key = request.headers.get('Authorization')?.replace(/^Bearer /, '')
  if (!key) return null
  const object = await env.BUCKET.get(`keys/${await sha256Hex(key)}`)
  const user = object ? (await object.text()).trim() : ''
  return NAME_PATTERN.test(user) ? user : null
}

async function listChats(env, user) {
  const prefix = `chats/${user}/`
  const list = []
  let cursor
  do {
    const page = await env.BUCKET.list({ prefix, cursor, include: ['customMetadata'] })
    for (const object of page.objects) {
      list.push({
        id: object.key.slice(prefix.length, -'.json'.length),
        title: object.customMetadata?.title ?? '',
        updatedAt: Number(object.customMetadata?.updatedAt ?? 0),
      })
    }
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  return list.sort((a, b) => b.updatedAt - a.updatedAt)
}

async function handle(request, env) {
  const { pathname } = new URL(request.url)
  const user = await authenticate(request, env)
  if (!user) return new Response(null, { status: 401 })

  if (pathname === '/api/me' && request.method === 'GET') return Response.json({ user })
  if (pathname === '/api/chats' && request.method === 'GET') return Response.json(await listChats(env, user))

  const match = pathname.match(/^\/api\/chats\/([^/]+)$/)
  if (!match) return new Response(null, { status: 404 })
  const id = decodeURIComponent(match[1])
  if (!ID_PATTERN.test(id)) return new Response(null, { status: 400 })
  const key = `chats/${user}/${id}.json`

  if (request.method === 'GET') {
    const object = await env.BUCKET.get(key)
    if (!object) return new Response(null, { status: 404 })
    return new Response(object.body, { headers: { 'Content-Type': 'application/json' } })
  }
  if (request.method === 'PUT') {
    const length = Number(request.headers.get('Content-Length'))
    const updatedAt = Number(request.headers.get('X-Chat-Updated-At'))
    let title
    try {
      title = decodeURIComponent(request.headers.get('X-Chat-Title') ?? '').slice(0, MAX_TITLE_LENGTH)
    } catch {
      return new Response(null, { status: 400 })
    }
    if (!length || length > MAX_BODY_BYTES || !Number.isFinite(updatedAt)) return new Response(null, { status: 400 })
    await env.BUCKET.put(key, request.body, {
      httpMetadata: { contentType: 'application/json' },
      customMetadata: { title, updatedAt: String(updatedAt) },
    })
    return new Response(null, { status: 204 })
  }
  if (request.method === 'DELETE') {
    await env.BUCKET.delete(key)
    return new Response(null, { status: 204 })
  }
  return new Response(null, { status: 405 })
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin')
    const cors = {}
    if (origin && env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).includes(origin)) {
      cors['Access-Control-Allow-Origin'] = origin
      cors['Access-Control-Allow-Headers'] = 'Authorization, Content-Type, X-Chat-Title, X-Chat-Updated-At'
      cors['Access-Control-Allow-Methods'] = 'GET, PUT, DELETE, OPTIONS'
      cors['Vary'] = 'Origin'
    }
    let response
    try {
      response = request.method === 'OPTIONS' ? new Response(null, { status: 204 }) : await handle(request, env)
    } catch (e) {
      console.error(e)
      response = new Response(null, { status: 500 })
    }
    // Response.json 등으로 만든 응답은 헤더가 불변이라 복사본에 CORS 헤더를 붙인다.
    response = new Response(response.body, response)
    for (const [name, value] of Object.entries(cors)) response.headers.set(name, value)
    return response
  },
}
