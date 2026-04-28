const GH_API = 'https://api.github.com'

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

export async function getGitHubUser(token: string): Promise<{ login: string; avatar_url: string }> {
  const res = await fetch(`${GH_API}/user`, { headers: ghHeaders(token) })
  if (!res.ok) throw new Error(`GitHub 인증 실패 — 토큰을 확인하세요 (${res.status})`)
  return res.json()
}

/** UTF-8 문자열을 Base64로 인코딩 (GitHub Contents API용) */
function toBase64(str: string): string {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))))
}

export async function createRepoWithFiles(
  token: string,
  repoName: string,
  files: Record<string, string>,
): Promise<{ owner: string; repo: string; url: string }> {
  const headers = ghHeaders(token)
  const { login: owner } = await getGitHubUser(token)

  // 1. Create empty repo (no auto_init — avoids timing/409 issues with git data API)
  const createRes = await fetch(`${GH_API}/user/repos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: repoName,
      description: 'Created with Vibe Coding AI 🚀',
      private: false,
      auto_init: false,
    }),
  })
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message || `저장소 생성 실패 (${createRes.status})`)
  }

  // 2. Upload files sequentially via Contents API.
  //    First PUT on an empty repo creates the initial commit + main branch automatically.
  const entries = Object.entries(files)
  for (let i = 0; i < entries.length; i++) {
    const [path, content] = entries[i]
    const putRes = await fetch(`${GH_API}/repos/${owner}/${repoName}/contents/${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: i === 0
          ? '🚀 Initial commit — created with Vibe Coding AI'
          : `Add ${path}`,
        content: toBase64(content),
      }),
    })
    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({})) as { message?: string }
      throw new Error(err.message || `파일 업로드 실패: ${path} (${putRes.status})`)
    }
  }

  return { owner, repo: repoName, url: `https://github.com/${owner}/${repoName}` }
}

/** Base64(GitHub API) → UTF-8 string */
function fromBase64(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

/** GitHub URL 파싱: https://github.com/owner/repo[/tree/branch] */
function parseGithubUrl(url: string): { owner: string; repo: string; branch?: string } {
  const match = url.trim().replace(/\.git$/, '').match(/github\.com\/([^/]+)\/([^/]+?)(?:\/tree\/([^/?#]+))?(?:[/?#].*)?$/)
  if (!match) throw new Error('올바른 GitHub URL을 입력하세요\n예: https://github.com/owner/repo')
  return { owner: match[1], repo: match[2], branch: match[3] }
}

const TEXT_EXT = /\.(html|css|js|jsx|ts|tsx|json|md|txt|svg|vue|mjs|cjs|yaml|yml|toml|gitignore|prettierrc|eslintrc|babelrc|env\.example|nvmrc|editorconfig)$/i
const SKIP_DIRS = /^(node_modules|\.git|dist|build|\.next|\.nuxt|coverage|\.cache)\//

export async function fetchRepoFiles(
  repoUrl: string,
  token?: string,
): Promise<{ files: Record<string, string>; owner: string; repo: string; branch: string }> {
  const { owner, repo, branch: branchFromUrl } = parseGithubUrl(repoUrl)

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token?.trim()) headers.Authorization = `Bearer ${token.trim()}`

  // 기본 브랜치 확인
  let branch = branchFromUrl
  if (!branch) {
    const repoRes = await fetch(`${GH_API}/repos/${owner}/${repo}`, { headers })
    if (!repoRes.ok) throw new Error(`저장소를 찾을 수 없습니다 (${repoRes.status})\n비공개 저장소라면 GitHub 토큰을 입력하세요`)
    const repoData = await repoRes.json() as { default_branch: string }
    branch = repoData.default_branch
  }

  // 파일 트리 전체 조회
  const treeRes = await fetch(`${GH_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers })
  if (!treeRes.ok) throw new Error(`파일 트리를 가져오지 못했습니다 (${treeRes.status})`)
  const { tree } = await treeRes.json() as { tree: Array<{ path: string; type: string; size?: number }>; truncated: boolean }

  const blobs = tree.filter(item =>
    item.type === 'blob' &&
    TEXT_EXT.test(item.path) &&
    !SKIP_DIRS.test(item.path) &&
    (item.size ?? 0) < 300_000,
  ).slice(0, 60) // 최대 60개

  // 파일 내용 병렬 fetch (5개씩 배치)
  const files: Record<string, string> = {}
  const BATCH = 5
  for (let i = 0; i < blobs.length; i += BATCH) {
    await Promise.all(blobs.slice(i, i + BATCH).map(async item => {
      const res = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${item.path}?ref=${branch}`, { headers })
      if (!res.ok) return
      const data = await res.json() as { content?: string; encoding?: string }
      if (data.content && data.encoding === 'base64') {
        try { files[item.path] = fromBase64(data.content) } catch { /* skip binary */ }
      }
    }))
  }

  if (Object.keys(files).length === 0) throw new Error('텍스트 파일을 찾을 수 없습니다')
  return { files, owner, repo, branch }
}

export function detectProjectType(files: Record<string, string>): 'html' | 'react' | 'vue' {
  const names = Object.keys(files)
  if (names.some(f => f.endsWith('.vue'))) return 'vue'
  if (names.some(f => f.endsWith('.jsx') || f.endsWith('.tsx'))) return 'react'
  const pkg = files['package.json']
  if (pkg) {
    try {
      const p = JSON.parse(pkg) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
      const deps = { ...p.dependencies, ...p.devDependencies }
      if (deps.react) return 'react'
      if (deps.vue) return 'vue'
    } catch { /* ignore */ }
  }
  return 'html'
}

