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

export async function createRepoWithFiles(
  token: string,
  repoName: string,
  files: Record<string, string>,
): Promise<{ owner: string; repo: string; url: string }> {
  const headers = ghHeaders(token)
  const { login: owner } = await getGitHubUser(token)

  // 1. Create repo
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

  // 2. Create blobs (parallel)
  const treeItems = await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const blobRes = await fetch(`${GH_API}/repos/${owner}/${repoName}/git/blobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content, encoding: 'utf-8' }),
      })
      const { sha } = await blobRes.json() as { sha: string }
      return { path, mode: '100644' as const, type: 'blob' as const, sha }
    })
  )

  // 3. Create tree
  const { sha: treeSha } = await fetch(`${GH_API}/repos/${owner}/${repoName}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tree: treeItems }),
  }).then(r => r.json()) as { sha: string }

  // 4. Create commit
  const { sha: commitSha } = await fetch(`${GH_API}/repos/${owner}/${repoName}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: '🚀 Initial commit — created with Vibe Coding AI',
      tree: treeSha,
      parents: [],
    }),
  }).then(r => r.json()) as { sha: string }

  // 5. Set main branch
  await fetch(`${GH_API}/repos/${owner}/${repoName}/git/refs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ref: 'refs/heads/main', sha: commitSha }),
  })

  return { owner, repo: repoName, url: `https://github.com/${owner}/${repoName}` }
}
