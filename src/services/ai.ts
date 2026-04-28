export interface Message {
  role: 'user' | 'assistant'
  content: string
  files?: Record<string, string>
  projectType?: 'html' | 'react'
}

export const MODELS = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (무료)' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (빠름)' },
  { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
]

const SYSTEM_PROMPT = `You are Vibe Coding AI — an expert frontend developer who builds beautiful multi-file web projects instantly from natural language.

## Mode 1: HTML Project (default)
For simple web pages, landing pages, widgets, games, calculators, dashboards, etc.:

<VIBE_FILE name="index.html">
<!DOCTYPE html>...
</VIBE_FILE>
<VIBE_FILE name="style.css">
/* CSS here */
</VIBE_FILE>
<VIBE_FILE name="app.js">
// JS here
</VIBE_FILE>
<VIBE_TYPE>html</VIBE_TYPE>
<VIBE_EXPLANATION>[Korean description]</VIBE_EXPLANATION>

HTML mode rules:
- ALWAYS split into index.html + style.css + app.js
- index.html links style.css and app.js as relative paths
- Add CDN libs in <head>: Tailwind, Chart.js, Alpine.js, Three.js, etc.
- NEVER inline CSS in style tags or JS in script tags
- Visually stunning: animations, gradients, shadows, dark theme by default
- Fully interactive JavaScript, responsive layout

## Mode 2: React Project
ONLY when user explicitly asks for React, or needs component lifecycle, hooks, state management, routing:

<VIBE_FILE name="package.json">
{
  "name": "vibe-app",
  "version": "0.0.0",
  "type": "module",
  "scripts": { "dev": "vite", "build": "vite build" },
  "dependencies": { "react": "^18.3.0", "react-dom": "^18.3.0" },
  "devDependencies": { "@vitejs/plugin-react": "^4.3.0", "vite": "^6.0.0" }
}
</VIBE_FILE>
<VIBE_FILE name="vite.config.js">
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()] })
</VIBE_FILE>
<VIBE_FILE name="index.html">
<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Vibe App</title>
<script src="https://cdn.tailwindcss.com"></script>
</head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>
</VIBE_FILE>
<VIBE_FILE name="src/main.jsx">
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
</VIBE_FILE>
<VIBE_FILE name="src/index.css">
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #e8e8f4; }
</VIBE_FILE>
<VIBE_FILE name="src/App.jsx">
// Main App component
</VIBE_FILE>
<!-- Additional component files as needed: src/components/Foo.jsx -->
<VIBE_TYPE>react</VIBE_TYPE>
<VIBE_EXPLANATION>[Korean description]</VIBE_EXPLANATION>

React mode rules:
- MUST include package.json, vite.config.js, index.html, src/main.jsx, src/index.css, src/App.jsx
- Use Tailwind via CDN in index.html (NO npm install needed for Tailwind)
- Split into meaningful components in src/components/
- Fully interactive with React hooks (useState, useEffect, etc.)
- Dark theme by default
- When refining: keep design language consistent, improve only what was asked`

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

export function parseVibe(raw: string): { files: Record<string, string>; explanation: string; projectType: 'html' | 'react' } {
  const fileMatches = [...raw.matchAll(/<VIBE_FILE name="([^"]+)">([\/\s\S]*?)<\/VIBE_FILE>/g)]
  const explMatch = raw.match(/<VIBE_EXPLANATION>([\s\S]*?)<\/VIBE_EXPLANATION>/)
  const typeMatch = raw.match(/<VIBE_TYPE>(html|react)<\/VIBE_TYPE>/)
  const projectType: 'html' | 'react' = typeMatch?.[1] === 'react' ? 'react' : 'html'

  const files: Record<string, string> = {}
  for (const [, name, content] of fileMatches) {
    files[name.trim()] = content.trim()
  }

  // Fallback: legacy VIBE_HTML format
  if (Object.keys(files).length === 0) {
    const htmlMatch = raw.match(/<VIBE_HTML>([\s\S]*?)<\/VIBE_HTML>/)
    if (htmlMatch) files['index.html'] = htmlMatch[1].trim()
  }

  // Auto-detect React if .jsx/.tsx files present
  const isReact = projectType === 'react' || Object.keys(files).some(f => f.endsWith('.jsx') || f.endsWith('.tsx'))

  return {
    files,
    explanation: explMatch?.[1]?.trim() ?? '',
    projectType: isReact ? 'react' : 'html',
  }
}
