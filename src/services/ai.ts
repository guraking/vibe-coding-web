export interface Message {
  role: 'user' | 'assistant'
  content: string
  files?: Record<string, string>
  projectType?: 'html' | 'react' | 'vue'
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  /** 분당 한도 (-1 = 정보 없음) */
  limitPerMin: number
  /** 분당 남은 토큰 (-1 = 정보 없음) */
  remainingPerMin: number
  /** 남은 토큰 리셋까지 초 (-1 = 정보 없음) */
  resetInSeconds: number
}

export type AIProvider = 'groq' | 'openai' | 'gemini'

export interface AIModel {
  id: string
  label: string
  provider: AIProvider
}

/** "33m24.4s" 또는 "45.2s" 형태의 Groq retry 문자열을 초로 변환 */
function parseRetrySeconds(msg: string): number {
  const m = msg.match(/try again in (\d+)m([\d.]+)s/)
  if (m) return Math.ceil(parseInt(m[1], 10) * 60 + parseFloat(m[2]))
  const s = msg.match(/try again in ([\d.]+)s/)
  if (s) return Math.ceil(parseFloat(s[1]))
  return 60
}

export class RateLimitError extends Error {
  retryAfterSeconds: number
  limitTokens: number
  usedTokens: number
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitError'
    this.retryAfterSeconds = parseRetrySeconds(message)
    const limitMatch = message.match(/Limit (\d+)/)
    const usedMatch = message.match(/Used (\d+)/)
    this.limitTokens = limitMatch ? parseInt(limitMatch[1], 10) : 0
    this.usedTokens = usedMatch ? parseInt(usedMatch[1], 10) : 0
  }
}

export const PROVIDERS: { id: AIProvider; label: string }[] = [
  { id: 'groq', label: 'Groq' },
  { id: 'openai', label: 'ChatGPT' },
  { id: 'gemini', label: 'Gemini' },
]

export const MODELS: AIModel[] = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (무료)', provider: 'groq' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (빠름)', provider: 'groq' },
  { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', provider: 'groq' },
  { id: 'gpt-5.5', label: 'GPT-5.5', provider: 'openai' },
  { id: 'gpt-5.5-mini', label: 'GPT-5.5 mini', provider: 'openai' },
  { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', provider: 'gemini' },
  { id: 'gemini-3.1-flash', label: 'Gemini 3.1 Flash', provider: 'gemini' },
]

export function getModelsByProvider(provider: AIProvider): AIModel[] {
  return MODELS.filter((m) => m.provider === provider)
}

export function getDefaultModel(provider: AIProvider): string {
  return getModelsByProvider(provider)[0]?.id ?? MODELS[0].id
}

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
- When refining: keep design language consistent, improve only what was asked

## Mode 3: Vue Project
ONLY when user explicitly asks for Vue:

<VIBE_FILE name="package.json">
{
  "name": "vibe-app",
  "version": "0.0.0",
  "type": "module",
  "scripts": { "dev": "vite", "build": "vite build" },
  "dependencies": { "vue": "^3.5.0" },
  "devDependencies": { "@vitejs/plugin-vue": "^5.2.0", "vite": "^6.0.0" }
}
</VIBE_FILE>
<VIBE_FILE name="vite.config.js">
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({ plugins: [vue()] })
</VIBE_FILE>
<VIBE_FILE name="index.html">
<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Vibe App</title>
<script src="https://cdn.tailwindcss.com"></script>
</head><body><div id="app"></div><script type="module" src="/src/main.js"></script></body></html>
</VIBE_FILE>
<VIBE_FILE name="src/main.js">
import { createApp } from 'vue'
import './index.css'
import App from './App.vue'
createApp(App).mount('#app')
</VIBE_FILE>
<VIBE_FILE name="src/index.css">
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #e8e8f4; }
</VIBE_FILE>
<VIBE_FILE name="src/App.vue">
<template>
  <!-- root template -->
</template>
<script setup>
// composition API here
</script>
<style scoped>
/* scoped styles */
</style>
</VIBE_FILE>
<!-- Additional components: src/components/Foo.vue -->
<VIBE_TYPE>vue</VIBE_TYPE>
<VIBE_EXPLANATION>[Korean description]</VIBE_EXPLANATION>

Vue mode rules:
- MUST include package.json, vite.config.js, index.html, src/main.js, src/index.css, src/App.vue
- Use Tailwind via CDN in index.html (NO npm install needed)
- Use Vue 3 Composition API with <script setup>
- Split into .vue SFC components in src/components/
- Use ref(), reactive(), computed(), onMounted() as needed
- Dark theme by default
- When refining: keep design language consistent, improve only what was asked`

export async function* streamCode(
  provider: AIProvider,
  apiKey: string,
  model: string,
  messages: Message[],
  currentFiles?: Record<string, string>,
  onUsage?: (usage: TokenUsage) => void,
): AsyncGenerator<string, void, unknown> {
  const currentContext = currentFiles && Object.keys(currentFiles).length > 0
    ? `\n\nThe user is refining their existing project. Current files:\n` +
      Object.entries(currentFiles)
        .map(([name, content]) => `--- ${name} ---\n${content}`)
        .join('\n\n')
    : ''

  const systemContent = SYSTEM_PROMPT + currentContext

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${systemContent}\n\nConversation:\n${messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      const msg = (err as { error?: { message?: string } })?.error?.message ?? `API 오류 (HTTP ${response.status})`
      throw new Error(msg)
    }

    const parsed = await response.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
    }
    const text = parsed.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    if (text) yield text
    if (onUsage && parsed.usageMetadata) {
      onUsage({
        promptTokens: parsed.usageMetadata.promptTokenCount ?? 0,
        completionTokens: parsed.usageMetadata.candidatesTokenCount ?? 0,
        totalTokens: parsed.usageMetadata.totalTokenCount ?? 0,
        limitPerMin: -1,
        remainingPerMin: -1,
        resetInSeconds: -1,
      })
    }
    return
  }

  const endpoint = provider === 'openai'
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://api.groq.com/openai/v1/chat/completions'

  const response = await fetch(endpoint, {
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
      ...(provider === 'openai' ? {} : { temperature: 0.7 }),
      ...(provider === 'groq' ? { max_tokens: 4096 } : {}),
      ...(provider === 'openai' ? { stream_options: { include_usage: true } } : {}),
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = (err as { error?: { message?: string } })?.error?.message ?? `API 오류 (HTTP ${response.status})`
    if (provider === 'groq' && response.status === 429) throw new RateLimitError(msg)
    throw new Error(msg)
  }

  const limitPerMin = parseInt(response.headers.get('x-ratelimit-limit-tokens') ?? '-1', 10)
  const remainingPerMin = parseInt(response.headers.get('x-ratelimit-remaining-tokens') ?? '-1', 10)
  const resetRaw = response.headers.get('x-ratelimit-reset-tokens') ?? ''
  const resetInSeconds = (() => {
    const m = resetRaw.match(/(\d+)m(\d+)?s?/)
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2] ?? '0', 10)
    const s = resetRaw.match(/(\d+)s/)
    if (s) return parseInt(s[1], 10)
    return -1
  })()

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
            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
            x_groq?: { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }
          }
          const content = parsed.choices?.[0]?.delta?.content
          if (typeof content === 'string') yield content

          const usage = provider === 'groq' ? parsed.x_groq?.usage : parsed.usage
          if (usage && onUsage) {
            onUsage({
              promptTokens: usage.prompt_tokens ?? 0,
              completionTokens: usage.completion_tokens ?? 0,
              totalTokens: usage.total_tokens ?? 0,
              limitPerMin,
              remainingPerMin,
              resetInSeconds,
            })
          }
        } catch {
          // skip malformed SSE chunks
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export function parseVibe(raw: string): { files: Record<string, string>; explanation: string; projectType: 'html' | 'react' | 'vue' } {
  const fileMatches = [...raw.matchAll(/<VIBE_FILE name="([^"]+)">([/\s\S]*?)<\/VIBE_FILE>/g)]
  const explMatch = raw.match(/<VIBE_EXPLANATION>([\s\S]*?)<\/VIBE_EXPLANATION>/)
  const typeMatch = raw.match(/<VIBE_TYPE>(html|react|vue)<\/VIBE_TYPE>/)
  const projectType: 'html' | 'react' | 'vue' = (typeMatch?.[1] as 'html' | 'react' | 'vue') ?? 'html'

  const files: Record<string, string> = {}
  for (const [, name, content] of fileMatches) {
    files[name.trim()] = content.trim()
  }

  // Fallback: legacy VIBE_HTML format
  if (Object.keys(files).length === 0) {
    const htmlMatch = raw.match(/<VIBE_HTML>([\s\S]*?)<\/VIBE_HTML>/)
    if (htmlMatch) files['index.html'] = htmlMatch[1].trim()
  }

  // Auto-detect by file extensions
  const fileNames = Object.keys(files)
  const isVue = projectType === 'vue' || fileNames.some(f => f.endsWith('.vue'))
  const isReact = !isVue && (projectType === 'react' || fileNames.some(f => f.endsWith('.jsx') || f.endsWith('.tsx')))

  return {
    files,
    explanation: explMatch?.[1]?.trim() ?? '',
    projectType: isVue ? 'vue' : isReact ? 'react' : 'html',
  }
}
