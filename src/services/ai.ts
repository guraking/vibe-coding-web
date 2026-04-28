export interface Message {
  role: 'user' | 'assistant'
  content: string
  files?: Record<string, string>
}

export const MODELS = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (무료)' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (빠름)' },
  { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
]

const SYSTEM_PROMPT = `You are Vibe Coding AI — an expert frontend developer who builds beautiful multi-file web projects instantly from natural language.

Generate a complete project with SEPARATE files. Your response MUST use EXACTLY this format:

<VIBE_FILE name="index.html">
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>App Title</title>
  <link rel="stylesheet" href="style.css" />
  <!-- CDN libraries here if needed -->
</head>
<body>
  <!-- HTML here -->
  <script src="app.js"></script>
</body>
</html>
</VIBE_FILE>
<VIBE_FILE name="style.css">
/* All CSS here */
</VIBE_FILE>
<VIBE_FILE name="app.js">
// All JavaScript here
</VIBE_FILE>
<VIBE_EXPLANATION>
[1-2 sentence description in Korean of what was built]
</VIBE_EXPLANATION>

Rules:
- ALWAYS split into at least index.html + style.css + app.js
- index.html references style.css and app.js as relative paths
- You MAY add CDN libraries in index.html <head>: Tailwind (<script src="https://cdn.tailwindcss.com"></script>), Chart.js, Alpine.js, Three.js, etc.
- Visually stunning: CSS animations, gradients, shadows, modern design
- Dark theme by default unless user requests light
- Fully interactive and functional JavaScript
- Responsive layout
- When refining: keep design language consistent, improve only what was asked
- NEVER put JS in HTML inline script tags — put it in app.js
- NEVER put CSS in HTML style tags — put it in style.css`

export async function* streamCode(
  apiKey: string,
  model: string,
  messages: Message[],
  currentFiles?: Record<string, string>,
): AsyncGenerator<string, void, unknown> {
  const currentContext = currentFiles && Object.keys(currentFiles).length > 0
    ? `\n\nThe user is refining their existing project. Current files:\n` +
      Object.entries(currentFiles)
        .map(([name, content]) => `--- ${name} ---\n${content}`)
        .join('\n\n')
    : ''

  const systemContent = SYSTEM_PROMPT + currentContext

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemContent },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } })?.error?.message ??
        `API 오류 (HTTP ${response.status})`,
    )
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data) as {
            choices?: { delta?: { content?: string } }[]
          }
          const content = parsed.choices?.[0]?.delta?.content
          if (typeof content === 'string') yield content
        } catch {
          // skip malformed SSE chunks
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export function parseVibe(raw: string): { files: Record<string, string>; explanation: string } {
  const fileMatches = [...raw.matchAll(/<VIBE_FILE name="([^"]+)">([\/\s\S]*?)<\/VIBE_FILE>/g)]
  const explMatch = raw.match(/<VIBE_EXPLANATION>([\s\S]*?)<\/VIBE_EXPLANATION>/)

  const files: Record<string, string> = {}
  for (const [, name, content] of fileMatches) {
    files[name.trim()] = content.trim()
  }

  // Fallback: legacy VIBE_HTML format
  if (Object.keys(files).length === 0) {
    const htmlMatch = raw.match(/<VIBE_HTML>([\s\S]*?)<\/VIBE_HTML>/)
    if (htmlMatch) files['index.html'] = htmlMatch[1].trim()
  }

  return {
    files,
    explanation: explMatch?.[1]?.trim() ?? '',
  }
}
