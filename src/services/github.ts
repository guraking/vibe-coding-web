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
