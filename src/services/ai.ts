export interface Message {
  role: 'user' | 'assistant'
  content: string
  html?: string
}

export const MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
]

const SYSTEM_PROMPT = `You are Vibe Coding AI — an expert frontend developer who builds beautiful, interactive web UIs instantly from natural language descriptions.

When the user describes what they want, generate a COMPLETE, self-contained HTML page.

Your response MUST use this EXACT format (no extra text before/after):

<VIBE_HTML>
[Complete HTML — must start with <!DOCTYPE html> and end with </html>]
</VIBE_HTML>
<VIBE_EXPLANATION>
[1-2 sentence description in Korean of what was built]
</VIBE_EXPLANATION>

HTML requirements:
- 100% self-contained: all CSS and JS inline, no external files
- You MAY use CDN libraries: Tailwind (<script src="https://cdn.tailwindcss.com"></script>), Chart.js, Alpine.js, etc.
- Visually stunning: gradients, shadows, micro-animations, modern design
- Dark theme by default unless user requests light
- Fully interactive and functional JavaScript
- Responsive layout
- When modifying/refining: keep overall design language consistent and improve only what was asked`

export async function* streamCode(
  apiKey: string,
  model: string,
  messages: Message[],
  currentHtml?: string,
): AsyncGenerator<string, void, unknown> {
  const systemContent =
    SYSTEM_PROMPT +
    (currentHtml
      ? `\n\nThe user is refining their existing page. Current HTML:\n\`\`\`html\n${currentHtml}\n\`\`\``
      : '')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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

export function parseVibe(raw: string): { html: string; explanation: string } {
  const htmlMatch = raw.match(/<VIBE_HTML>([\s\S]*?)<\/VIBE_HTML>/)
  const explMatch = raw.match(/<VIBE_EXPLANATION>([\s\S]*?)<\/VIBE_EXPLANATION>/)
  return {
    html: htmlMatch?.[1]?.trim() ?? '',
    explanation: explMatch?.[1]?.trim() ?? '',
  }
}
