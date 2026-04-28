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

/** URL 파싱 — 실패 시 null 반환 (throw 없음) */
export function tryParseGithubUrl(url: string): { owner: string; repo: string; branch?: string } | null {
  try {
    const match = url.trim().replace(/\.git$/, '').match(/github\.com\/([^/]+)\/([^/]+?)(?:\/tree\/([^/?#]+))?(?:[/?#].*)?$/)
    if (!match) return null
    return { owner: match[1], repo: match[2], branch: match[3] }
  } catch {
    return null
  }
}

interface ProjectCache {
  files: Record<string, string>
  projectType: 'html' | 'react' | 'vue'
  branch: string
  cachedAt: number
}

const CACHE_PREFIX = 'vibe_project_'

export function getCachedProject(owner: string, repo: string): ProjectCache | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${owner}/${repo}`)
    return raw ? (JSON.parse(raw) as ProjectCache) : null
  } catch {
    return null
  }
}

export function setCachedProject(
  owner: string,
  repo: string,
  files: Record<string, string>,
  projectType: 'html' | 'react' | 'vue',
  branch: string,
): void {
  try {
    const cache: ProjectCache = { files, projectType, branch, cachedAt: Date.now() }
    localStorage.setItem(`${CACHE_PREFIX}${owner}/${repo}`, JSON.stringify(cache))
  } catch {
    // localStorage 용량 초과 — 무시
  }
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
  const projectType = detectProjectType(files)
  setCachedProject(owner, repo, files, projectType, branch)
  return { files, owner, repo, branch }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function generateDeployWorkflow(branch: string, repo: string): string {
  return `name: Deploy to GitHub Pages
on:
  push:
    branches: ["${branch}"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build-and-deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci --prefer-offline || npm install
      - name: Build
        run: |
          if npx --no vite build --base=/${repo}/ 2>/dev/null; then
            echo "vite build ok"
          elif npm run build -- --base=/${repo}/ 2>/dev/null; then
            echo "npm build ok"
          else
            npm run build
          fi
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
`
}

/**
 * 기존 저장소에 GitHub Actions 워크플로우를 push하고 GitHub Pages 배포를 대기.
 * 배포 완료 후 URL 반환.
 * 필요 토큰 권한: repo + workflow + pages (fine-grained: contents write, pages write, actions read)
 */
export async function deployToGitHubPages(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  onStatus: (msg: string) => void,
): Promise<string> {
  const headers = ghHeaders(token)
  const pushedAt = new Date().toISOString()

  // ── Step 1: 워크플로우 파일 push ──────────────────────────────────────────
  onStatus('GitHub Actions 워크플로우 추가 중...')
  const workflowPath = '.github/workflows/vibe-deploy.yml'
  const workflowContent = generateDeployWorkflow(branch, repo)

  // 기존 파일 SHA 확인 (update 시 필요)
  let existingSha: string | undefined
  const checkRes = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${workflowPath}`, { headers })
  if (checkRes.ok) {
    const data = await checkRes.json() as { sha: string }
    existingSha = data.sha
  }

  const putBody: Record<string, unknown> = {
    message: existingSha ? 'chore: update vibe deploy workflow' : 'chore: add vibe GitHub Pages deploy workflow',
    content: toBase64(workflowContent),
    branch,
  }
  if (existingSha) putBody.sha = existingSha

  const putRes = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${workflowPath}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(putBody),
  })
  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({})) as { message?: string }
    const msg = err.message || ''
    if (msg.toLowerCase().includes('workflow') || putRes.status === 403) {
      throw new Error('토큰에 workflow 권한이 없습니다.\nGitHub 토큰을 재발급할 때 repo + workflow 스코프를 선택하세요.')
    }
    throw new Error(msg || `워크플로우 push 실패 (${putRes.status})`)
  }

  // ── Step 2: GitHub Pages 활성화 ───────────────────────────────────────────
  onStatus('GitHub Pages 활성화 중...')
  // GET으로 먼저 존재 여부 확인 → 없으면 POST, 있으면 PUT (409 방지)
  const pagesCheckRes = await fetch(`${GH_API}/repos/${owner}/${repo}/pages`, { headers })
  if (pagesCheckRes.status === 404) {
    // Pages 미존재 → 생성
    await fetch(`${GH_API}/repos/${owner}/${repo}/pages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ build_type: 'workflow' }),
    }).catch(() => {})
  } else if (pagesCheckRes.ok) {
    // Pages 이미 존재 → build_type 업데이트
    await fetch(`${GH_API}/repos/${owner}/${repo}/pages`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ build_type: 'workflow' }),
    }).catch(() => {})
  }
  // 그 외 오류(403 등)는 무시하고 진행 — workflow가 push됐으면 Pages 설정 없이도 run은 시작됨

  // ── Step 3: workflow run 탐색 (push 후 생성된 run) ────────────────────────
  onStatus('워크플로우 시작 대기 중...')
  await sleep(10_000) // GitHub Actions 큐 등록 대기

  const TIMEOUT_MS = 8 * 60 * 1000
  const startTime = Date.now()
  let runId: number | null = null
  let tick = 0

  while (Date.now() - startTime < TIMEOUT_MS) {
    tick++
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    const dots = '.'.repeat((tick % 3) + 1)

    // 새 run 탐색 (pushedAt 이후 생성된 run)
    if (runId === null) {
      const runsRes = await fetch(
        `${GH_API}/repos/${owner}/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=10`,
        { headers },
      ).catch(() => null)

      if (runsRes?.ok) {
        const data = await runsRes.json() as {
          workflow_runs: Array<{ id: number; status: string; conclusion: string | null; created_at: string }>
        }
        const found = data.workflow_runs.find(r => r.created_at >= pushedAt)
        if (found) runId = found.id
      }

      if (runId === null) {
        onStatus(`워크플로우 시작 대기 중${dots}  (${elapsed}초 경과)`)
        await sleep(6_000)
        continue
      }
    }

    // 특정 run 폴링
    const runRes = await fetch(`${GH_API}/repos/${owner}/${repo}/actions/runs/${runId}`, { headers }).catch(() => null)
    if (runRes?.ok) {
      const run = await runRes.json() as { status: string; conclusion: string | null }
      onStatus(`빌드 & 배포 중${dots}  (${elapsed}초 경과)`)

      if (run.status === 'completed') {
        if (run.conclusion === 'failure') {
          throw new Error(
            'GitHub Actions 빌드 실패.\n' +
            `https://github.com/${owner}/${repo}/actions/runs/${runId} 에서 로그를 확인하세요.`,
          )
        }
        if (run.conclusion === 'cancelled') {
          throw new Error('GitHub Actions 워크플로우가 취소되었습니다.')
        }
        if (run.conclusion === 'success') {
          onStatus('배포 완료! URL 확인 중...')
          await sleep(6_000) // Pages 등록 대기

          // 최대 5회 재시도로 URL 확인
          for (let i = 0; i < 6; i++) {
            const url = await fetchDeploymentUrl(owner, repo, token)
            if (url) return url
            await sleep(5_000)
          }
          // Pages API가 늦게 갱신되는 경우 fallback
          return `https://${owner}.github.io/${repo}/`
        }
      }
    }

    await sleep(8_000)
  }

  throw new Error(
    '배포 타임아웃 (8분).\n' +
    `https://github.com/${owner}/${repo}/actions 에서 진행 상황을 확인하세요.`,
  )
}

/**
 * GitHub Deployments API → GitHub Pages 순서로 배포 URL 탐색.
 * 찾지 못하면 null 반환.
 */
export async function fetchDeploymentUrl(
  owner: string,
  repo: string,
  token?: string,
): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token?.trim()) headers.Authorization = `Bearer ${token.trim()}`

  // 1. Deployments API — 최근 10개 중 첫 번째 success 상태의 environment_url
  try {
    const res = await fetch(`${GH_API}/repos/${owner}/${repo}/deployments?per_page=10`, { headers })
    if (res.ok) {
      const deployments = await res.json() as Array<{ id: number }>
      for (const dep of deployments) {
        const sRes = await fetch(
          `${GH_API}/repos/${owner}/${repo}/deployments/${dep.id}/statuses?per_page=1`,
          { headers },
        )
        if (!sRes.ok) continue
        const statuses = await sRes.json() as Array<{ state: string; environment_url?: string; target_url?: string }>
        const ok = statuses.find(s => s.state === 'success')
        if (ok) {
          const url = ok.environment_url || ok.target_url
          // GitHub 기본 페이지 URL은 배포 URL이 아님
          if (url && url !== '' && !url.startsWith('https://github.com/')) return url
        }
      }
    }
  } catch { /* ignore */ }

  // 2. GitHub Pages fallback
  try {
    const res = await fetch(`${GH_API}/repos/${owner}/${repo}/pages`, { headers })
    if (res.ok) {
      const pages = await res.json() as { html_url?: string; status?: string }
      if (pages.html_url && pages.status === 'built') return pages.html_url
    }
  } catch { /* ignore */ }

  return null
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

