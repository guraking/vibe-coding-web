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

/**
 * 파일 경로에서 디렉터리 부분만 추출
 * @param path - 파일 경로
 * @returns 디렉터리 경로
 */
function dirname(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx >= 0 ? path.slice(0, idx) : ''
}

/**
 * 상대 경로를 절대 경로로 해석
 * @param fromFile - 기중이 되는 파일 경로
 * @param rel - 상대 경로
 * @returns 절대 경로
 */
function resolveRelativePath(fromFile: string, rel: string): string {
  const base = dirname(fromFile)
  const parts = `${base}/${rel}`.split('/').filter(Boolean)
  const out: string[] = []
  for (const part of parts) {
    if (part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return out.join('/')
}

/**
 * import 문 분석 시 고려할 가능한 파일 확장자 동우 생성
 * @param fromFile - import를 포함한 파일
 * @param rel - 상대 경로
 * @returns 가능한 파일 경로 배열
 */
function resolveImportCandidates(fromFile: string, rel: string): string[] {
  const base = resolveRelativePath(fromFile, rel)
  const extMatch = base.match(/\.[a-z0-9]+$/i)
  if (extMatch) return [base]

  const importerExt = fromFile.match(/\.[a-z0-9]+$/i)?.[0] ?? '.js'
  const jsLike = ['.js', '.jsx', '.ts', '.tsx', '.mjs']
  const prefExts = jsLike.includes(importerExt)
    ? [importerExt, '.jsx', '.tsx', '.js', '.ts', '.vue']
    : ['.js', '.jsx', '.tsx', '.ts', '.vue']

  const out: string[] = []
  for (const ext of prefExts) {
    out.push(`${base}${ext}`)
    out.push(`${base}/index${ext}`)
  }
  out.push(`${base}.css`)
  return Array.from(new Set(out))
}

/**
 * 누락된 import 모듈을 위한 폴백 파일 생성
 * @param path - 파일 경로
 * @returns 폴백 코드
 */
function makeFallbackModule(path: string): string {
  if (path.endsWith('.css')) return '/* generated missing import fallback */\n'
  if (path.endsWith('.vue')) {
    return `<template>\n  <div style="display:none"></div>\n</template>\n`
  }
  if (path.endsWith('.tsx')) {
    return `export const __vibePlaceholder = true\n\nexport default function VibePlaceholder(): JSX.Element | null {\n  return null\n}\n`
  }
  return `export const __vibePlaceholder = true\n\nexport default function VibePlaceholder() {\n  return null\n}\n`
}

/**
 * 누락된 import된 모듈 자동 생성
 * AI 응답에서 import하지만 구서되지 않은 파일을 자동으로 생성
 * @param files - 생성된 파일 객체
 * @returns 누락된 모듈이 추가된 파일 객체
 */
function ensureMissingImportedModules(files: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = { ...files }
  const sourceFiles = Object.keys(next).filter((p) => /\.(jsx?|tsx?|mjs|cjs|vue)$/i.test(p))

  for (const sourcePath of sourceFiles) {
    const content = next[sourcePath]
    if (!content) continue

    const imports = [
      ...content.matchAll(/import\s+[^'"\n]+\s+from\s+['"](.+?)['"]/g),
      ...content.matchAll(/import\s+['"](.+?)['"]/g),
    ]

    for (const m of imports) {
      const rel = m[1]
      if (!rel || (!rel.startsWith('./') && !rel.startsWith('../'))) continue

      const candidates = resolveImportCandidates(sourcePath, rel)
      const existing = candidates.find((c) => next[c] !== undefined)
      if (existing) continue

      const fallbackPath = candidates[0]
      next[fallbackPath] = makeFallbackModule(fallbackPath)
    }
  }

  return next
}

/**
 * CSS 문법 자동 수정
 * AI가 생성한 CSS에서 흔한 문법 오류 수정
 * @param content - 원본 CSS
 * @returns 수정된 CSS
 */
function repairCssSyntax(content: string): string {
  let out = content
  // Common LLM mistake: missing semicolon before the next custom property.
  out = out.replace(/([a-zA-Z-]+\s*:\s*[^;{}\n]+)\s+(--[a-zA-Z0-9_-]+\s*:)/g, '$1;\n  $2')
  return out
}

/**
 * Fix the most common LLM mistake in JS/JSX/TS/TSX:
 * Missing opening brace { for an array-of-objects element.
 * Example (bad):  label: 'Home', href: '#' },
 * Fixed:        { label: 'Home', href: '#' },
 */
function repairJsSyntax(content: string): string {
  const lines = content.split('\n')
  const fixed = lines.map((line) => {
    // Must be indented 2+ spaces, start with identifier: 'string', end with } or },
    if (
      /^ {2,}[a-zA-Z_$][a-zA-Z0-9_$]*\s*:\s*['"\`]/.test(line) &&
      /\}\s*,?\s*$/.test(line) &&
      !/^ {2,}\{/.test(line)
    ) {
      return line.replace(/^( +)/, '$1{ ')
    }
    return line
  })
  return fixed.join('\n')
}

function ensureProjectToolchain(files: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = { ...files }
  const type = detectProjectType(next)
  if (type === 'html') return next

  const pkgFallback = {
    name: 'vibe-app',
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: {} as Record<string, string>,
    devDependencies: {} as Record<string, string>,
  }

  let pkg = pkgFallback
  try {
    if (next['package.json']) {
      const parsed = JSON.parse(next['package.json']) as {
        name?: string
        version?: string
        type?: string
        scripts?: Record<string, string>
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }
      pkg = {
        name: parsed.name || pkgFallback.name,
        version: parsed.version || pkgFallback.version,
        type: parsed.type || pkgFallback.type,
        scripts: { ...pkgFallback.scripts, ...(parsed.scripts || {}) },
        dependencies: { ...(parsed.dependencies || {}) },
        devDependencies: { ...(parsed.devDependencies || {}) },
      }
    }
  } catch {
    pkg = pkgFallback
  }

  if (type === 'react') {
    if (!pkg.dependencies.react) pkg.dependencies.react = '^18.3.0'
    if (!pkg.dependencies['react-dom']) pkg.dependencies['react-dom'] = '^18.3.0'
    if (!pkg.devDependencies.vite) pkg.devDependencies.vite = '^6.0.0'
    if (!pkg.devDependencies['@vitejs/plugin-react']) pkg.devDependencies['@vitejs/plugin-react'] = '^4.3.0'

    if (!next['vite.config.js'] && !next['vite.config.ts']) {
      next['vite.config.js'] = `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})\n`
    }

    if (!next['src/main.jsx'] && !next['src/main.tsx']) {
      next['src/main.jsx'] = `import { StrictMode } from 'react'\nimport { createRoot } from 'react-dom/client'\nimport './index.css'\nimport App from './App.jsx'\n\ncreateRoot(document.getElementById('root')).render(\n  <StrictMode>\n    <App />\n  </StrictMode>,\n)\n`
    }
    if (!next['src/App.jsx'] && !next['src/App.tsx']) {
      next['src/App.jsx'] = `export default function App() {\n  return <div style={{ padding: 24 }}>Vibe App</div>\n}\n`
    }
    if (!next['src/index.css']) next['src/index.css'] = '/* generated fallback stylesheet */\n'
    if (!next['index.html']) {
      next['index.html'] = `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Vibe App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n`
    }
  }

  if (type === 'vue') {
    if (!pkg.dependencies.vue) pkg.dependencies.vue = '^3.5.0'
    if (!pkg.devDependencies.vite) pkg.devDependencies.vite = '^6.0.0'
    if (!pkg.devDependencies['@vitejs/plugin-vue']) pkg.devDependencies['@vitejs/plugin-vue'] = '^5.2.0'

    if (!next['vite.config.js'] && !next['vite.config.ts']) {
      next['vite.config.js'] = `import { defineConfig } from 'vite'\nimport vue from '@vitejs/plugin-vue'\n\nexport default defineConfig({\n  plugins: [vue()],\n})\n`
    }

    if (!next['src/main.js'] && !next['src/main.ts']) {
      next['src/main.js'] = `import { createApp } from 'vue'\nimport './index.css'\nimport App from './App.vue'\n\ncreateApp(App).mount('#app')\n`
    }
    if (!next['src/App.vue']) {
      next['src/App.vue'] = `<template>\n  <main style="padding: 24px;">Vibe App</main>\n</template>\n`
    }
    if (!next['src/index.css']) next['src/index.css'] = '/* generated fallback stylesheet */\n'
    if (!next['index.html']) {
      next['index.html'] = `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Vibe App</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/src/main.js"></script>\n  </body>\n</html>\n`
    }
  }

  next['package.json'] = JSON.stringify(pkg, null, 2)
  return next
}

function normalizeFilesForBuild(files: Record<string, string>, keepRawOutput = false): Record<string, string> {
  if (keepRawOutput) return { ...files }
  const next: Record<string, string> = ensureMissingImportedModules(ensureProjectToolchain(files))
  const mainCandidates = ['src/main.tsx', 'src/main.jsx', 'src/main.ts', 'src/main.js']

  for (const mainFile of mainCandidates) {
    const mainContent = next[mainFile]
    if (!mainContent) continue

    const appImport = mainContent.match(/import\s+App\s+from\s+['"](.+?)['"]/)
    if (appImport) {
      let appPath = resolveRelativePath(mainFile, appImport[1])
      if (!/\.[a-z0-9]+$/i.test(appPath)) {
        appPath += mainFile.endsWith('.tsx') ? '.tsx' : '.jsx'
      }
      if (!next[appPath]) {
        if (appPath.endsWith('.vue')) {
          next[appPath] = `<template>\n  <main style="padding:24px; font-family: system-ui;">\n    <h1>Vibe App</h1>\n    <p>Generated fallback App.vue</p>\n  </main>\n</template>\n\n<script setup>\n</script>\n`
        } else if (appPath.endsWith('.tsx')) {
          next[appPath] = `export default function App() {\n  return (\n    <main style={{ padding: 24, fontFamily: 'system-ui' }}>\n      <h1>Vibe App</h1>\n      <p>Generated fallback App.tsx</p>\n    </main>\n  )\n}\n`
        } else {
          next[appPath] = `export default function App() {\n  return (\n    <main style={{ padding: 24, fontFamily: 'system-ui' }}>\n      <h1>Vibe App</h1>\n      <p>Generated fallback App.jsx</p>\n    </main>\n  )\n}\n`
        }
      }
    }

    const cssImports = [...mainContent.matchAll(/import\s+['"](.+?\.css)['"]/g)]
    for (const m of cssImports) {
      const cssPath = resolveRelativePath(mainFile, m[1])
      if (!next[cssPath]) next[cssPath] = '/* generated fallback stylesheet */\n'
    }
  }

  for (const [path, content] of Object.entries(next)) {
    if (path.endsWith('.css')) {
      next[path] = repairCssSyntax(content)
    } else if (/\.(jsx?|tsx?)$/.test(path)) {
      next[path] = repairJsSyntax(content)
    }
  }

  return next
}

export async function createRepoWithFiles(
  token: string,
  repoName: string,
  files: Record<string, string>,
): Promise<{ owner: string; repo: string; branch: string; url: string }> {
  const headers = ghHeaders(token)
  const { login: owner } = await getGitHubUser(token)
  const normalizedFiles = normalizeFilesForBuild(files, false)
  const encodedOwner = encodeURIComponent(owner)
  const encodedRepo = encodeURIComponent(repoName)

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
    const err = await createRes.json().catch(() => ({})) as {
      message?: string
      errors?: Array<{ message?: string; code?: string; field?: string }>
    }
    const detail = (err.errors || [])
      .map((e) => e.message || [e.field, e.code].filter(Boolean).join(': '))
      .filter(Boolean)
      .join(', ')
    const msg = [err.message, detail].filter(Boolean).join(' | ')

    // If creation fails due to duplication/conflict, reuse existing repo automatically.
    if (createRes.status === 422 || createRes.status === 409) {
      const repoRes = await fetch(`${GH_API}/repos/${encodedOwner}/${encodedRepo}`, { headers })
      if (!repoRes.ok) throw new Error(msg || `저장소 생성 실패 (${createRes.status})`)
      const repoData = await repoRes.json() as { default_branch?: string }
      const branch = repoData.default_branch || 'main'
      await updateRepoWithFiles(token, owner, repoName, branch, normalizedFiles)
      return { owner, repo: repoName, branch, url: `https://github.com/${owner}/${repoName}` }
    }
    throw new Error(msg || `저장소 생성 실패 (${createRes.status})`)
  }

  // 2. Upload files sequentially via Contents API.
  //    First PUT on an empty repo creates the initial commit + main branch automatically.
  const entries = Object.entries(normalizedFiles)
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

  let branch = 'main'
  const repoRes = await fetch(`${GH_API}/repos/${encodedOwner}/${encodedRepo}`, { headers })
  if (repoRes.ok) {
    const repoData = await repoRes.json() as { default_branch?: string }
    branch = repoData.default_branch || 'main'
  }

  return { owner, repo: repoName, branch, url: `https://github.com/${owner}/${repoName}` }
}

export async function updateRepoWithFiles(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  files: Record<string, string>,
): Promise<{ owner: string; repo: string; branch: string; url: string }> {
  const headers = ghHeaders(token)
  const normalizedFiles = normalizeFilesForBuild(files, false)

  // Ensure the target repo is accessible with this token before uploading files.
  const repoRes = await fetch(`${GH_API}/repos/${owner}/${repo}`, { headers })
  if (!repoRes.ok) {
    const err = await repoRes.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message || `저장소 접근 실패 (${repoRes.status})`)
  }

  const entries = Object.entries(normalizedFiles)
  for (let i = 0; i < entries.length; i++) {
    const [path, content] = entries[i]
    const encodedPath = path.split('/').map(encodeURIComponent).join('/')

    let sha: string | undefined
    const currentRes = await fetch(
      `${GH_API}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
      { headers },
    )
    if (currentRes.ok) {
      const current = await currentRes.json() as { sha?: string }
      sha = current.sha
    } else if (currentRes.status !== 404) {
      const err = await currentRes.json().catch(() => ({})) as { message?: string }
      throw new Error(err.message || `기존 파일 조회 실패: ${path} (${currentRes.status})`)
    }

    const putRes = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${encodedPath}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: sha ? `Update ${path}` : `Add ${path}`,
        content: toBase64(content),
        branch,
        sha,
      }),
    })

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({})) as { message?: string }
      throw new Error(err.message || `파일 업로드 실패: ${path} (${putRes.status})`)
    }
  }

  return { owner, repo, branch, url: `https://github.com/${owner}/${repo}` }
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

async function patchLegacyEntryScriptPath(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  onStatus: (msg: string) => void,
): Promise<void> {
  const headers = ghHeaders(token)
  const path = 'index.html'

  const getRes = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`, {
    headers,
  }).catch(() => null)

  // If index.html does not exist (or inaccessible), skip auto-fix silently.
  if (!getRes?.ok) return

  const data = await getRes.json() as { content?: string; encoding?: string; sha?: string }
  if (!data.content || data.encoding !== 'base64' || !data.sha) return

  const current = fromBase64(data.content)
  const patched = current.replace(
    /(<script[^>]*\bsrc=)(["'])\/src\/(main\.(?:jsx|tsx|js|ts))\2([^>]*>)/gi,
    '$1$2./src/$3$2$4',
  )

  if (patched === current) return

  onStatus('기존 index.html 경로 자동 수정 중...')
  const putRes = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: 'fix: use relative entry path for GitHub Pages',
      content: toBase64(patched),
      sha: data.sha,
      branch,
    }),
  })

  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message || `기존 index.html 자동 수정 실패 (${putRes.status})`)
  }
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

  // ── Pre-step: patch legacy absolute entry path for existing repos ────────
  await patchLegacyEntryScriptPath(token, owner, repo, branch, onStatus)

  // ── Step 1: 워크플로우 파일 push ──────────────────────────────────────────
  onStatus('GitHub Actions 워크플로우 추가 중...')
  const workflowPath = '.github/workflows/vibe-deploy.yml'
  const workflowContent = generateDeployWorkflow(branch, repo)

  // GET-first 전략: sha를 먼저 조회해서 422 충돌을 사전에 방지
  let existingSha: string | undefined
  const checkRes = await fetch(
    `${GH_API}/repos/${owner}/${repo}/contents/${workflowPath}?ref=${encodeURIComponent(branch)}`,
    { headers },
  ).catch(() => null)
  if (checkRes?.ok) {
    const checkData = await checkRes.json().catch(() => ({})) as { sha?: string }
    existingSha = checkData.sha
  }

  const buildWorkflowBody = (sha?: string) => JSON.stringify({
    message: sha
      ? 'chore: update vibe GitHub Pages deploy workflow'
      : 'chore: add vibe GitHub Pages deploy workflow',
    content: toBase64(workflowContent),
    branch,
    ...(sha ? { sha } : {}),
  })

  let putRes = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${workflowPath}`, {
    method: 'PUT',
    headers,
    body: buildWorkflowBody(existingSha),
  })

  // 422: sha 충돌(stale/missing) → 재시도: 현재 sha를 다시 조회해 즉시 재PUT
  if (!putRes.ok && putRes.status === 422) {
    const retryGet = await fetch(
      `${GH_API}/repos/${owner}/${repo}/contents/${workflowPath}?ref=${encodeURIComponent(branch)}`,
      { headers },
    ).catch(() => null)
    const retrySha = retryGet?.ok
      ? ((await retryGet.json().catch(() => ({}))) as { sha?: string }).sha
      : undefined
    putRes = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${workflowPath}`, {
      method: 'PUT',
      headers,
      body: buildWorkflowBody(retrySha),
    })
  }

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
  const pagesRes = await fetch(`${GH_API}/repos/${owner}/${repo}/pages`, { headers }).catch(() => null)

  if (pagesRes?.ok) {
    const pagesData = await pagesRes.json().catch(() => ({})) as { build_type?: string }
    if (pagesData.build_type !== 'workflow') {
      await fetch(`${GH_API}/repos/${owner}/${repo}/pages`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ build_type: 'workflow' }),
      }).catch(() => {})
    }
  } else if (pagesRes?.status === 404) {
    const pagesCreateRes = await fetch(`${GH_API}/repos/${owner}/${repo}/pages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ build_type: 'workflow' }),
    }).catch(() => null)

    if (pagesCreateRes && (pagesCreateRes.status === 409 || pagesCreateRes.status === 422)) {
      await fetch(`${GH_API}/repos/${owner}/${repo}/pages`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ build_type: 'workflow' }),
      }).catch(() => {})
    }
  }
  // 그 외 오류(403 등)는 무시하고 진행 — workflow가 push됐으면 Actions run은 시작됨

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

