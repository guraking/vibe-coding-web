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
  limitPerMin: number
  remainingPerMin: number
  resetInSeconds: number
}

export type AIProvider = 'groq' | 'openai' | 'gemini'

export interface AIModel {
  id: string
  label: string
  provider: AIProvider
}

/**
 * Groq (33m24.4s 또는 45.2s) 형식을 초 단위로 변환
 */
/**
 * Groq Rate Limit 에러 메시지에서 재시도 대기 시간 파싱
 * 형식 예: \"try again in 2m45.3s\" → 165초, \"try again in 45.2s\" → 46초
 * @param msg - Groq API 에러 메시지
 * @returns 재시도 대기 시간 (초 단위)
 */
function parseRetrySeconds(msg: string): number {
  // 분과 초 형식 (예: 2m45.3s)
  const m = msg.match(/try again in (\d+)m([\d.]+)s/)
  if (m) return Math.ceil(parseInt(m[1], 10) * 60 + parseFloat(m[2]))
  // 초 형식만 있는 경우 (예: 45.2s)
  const s = msg.match(/try again in ([\d.]+)s/)
  if (s) return Math.ceil(parseFloat(s[1]))
  // 형식을 찾을 수 없으면 기본값 60초
  return 60
}

/**
 * Groq API Rate Limit 에러 클래스
 * API 일일 토큰 한도 초과 시 발생
 * 재시도 가능 시간과 토큰 사용량 정보 포함
 * 
 * @property retryAfterSeconds - 재시도 대기 시간 (초)
 * @property limitTokens - 일일 토큰 한도
 * @property usedTokens - 이미 사용한 토큰 수
 */
export class RateLimitError extends Error {
  retryAfterSeconds: number
  limitTokens: number
  usedTokens: number
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitError'
    // 에러 메시지에서 대기 시간 파싱
    this.retryAfterSeconds = parseRetrySeconds(message)
    // 에러 메시지에서 토큰 한도와 사용량 추출
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

/**
 * 특정 AI 제공자의 모든 사용 가능한 모델 목록 조회
 * @param provider - AI 제공자 (groq/openai/gemini)
 * @returns 해당 제공자의 모델 배열
 */
export function getModelsByProvider(provider: AIProvider): AIModel[] {
  return MODELS.filter((m) => m.provider === provider)
}

/**
 * 특정 AI 제공자의 기본 모델 ID 반환
 * 모델 목록의 첫 번째 모델이 기본값
 * @param provider - AI 제공자 (groq/openai/gemini)
 * @returns 기본 모델 ID
 */
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
</head><body><div id="root"></div><script type="module" src="./src/main.jsx"></script></body></html>
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
- In index.html, entry script path MUST be relative ('./src/main.jsx'), never absolute ('/src/main.jsx')
- Split into meaningful components in src/components/
- Fully interactive with React hooks (useState, useEffect, etc.)
- Dark theme by default
- When refining: keep design language consistent, improve only what was asked
- CRITICAL SYNTAX: Every element in an array of objects MUST start with { — never omit the opening brace
  WRONG: [ label: 'Home', href: '#' }, ... ]
  RIGHT: [ { label: 'Home', href: '#' }, ... ]
- CRITICAL SYNTAX: Verify every JSX tag is properly closed and all parentheses/braces/brackets are balanced before outputting

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
</head><body><div id="app"></div><script type="module" src="./src/main.js"></script></body></html>
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
- In index.html, entry script path MUST be relative ('./src/main.js'), never absolute ('/src/main.js')
- Use Vue 3 Composition API with <script setup>
- Split into .vue SFC components in src/components/
- Use ref(), reactive(), computed(), onMounted() as needed
- Dark theme by default
- When refining: keep design language consistent, improve only what was asked`

/**
 * AI 스트리밍 코드 생성 함수
 * 
 * 기능:
 * - Groq, OpenAI, Gemini 여러 AI 제공자 지원
 * - 사용자 메시지 히스토리를 프롬프트로 전달
 * - 현재 프로젝트 파일을 컨텍스트에 포함 (리파인용)
 * - 스트리밍 방식으로 응답을 실시간 처리
 * - 토큰 사용량 추적 및 콜백 제공
 * 
 * @param provider - AI 제공자 (groq/openai/gemini)
 * @param apiKey - API 인증 키
 * @param model - 사용할 모델 ID
 * @param messages - 채팅 메시지 히스토리
 * @param currentFiles - 현재 프로젝트 파일들 (선택적)
 * @param onUsage - 토큰 사용량 업데이트 콜백
 * @returns 스트리밍 응답 청크들의 비동기 제너레이터
 */
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

/**
 * AI 응답을 파싱하여 파일과 프로젝트 타입 추출
 * <VIBE_FILE>, <VIBE_TYPE>, <VIBE_EXPLANATION> 형식 파싱
 * @param raw - 파싱할 원본 AI 응답
 * @returns 파일, 설명, 프로젝트 타입
 */
/**
 * AI 응답을 파싱하여 파일과 프로젝트 타입 추출
 * 
 * AI는 다음 형식으로 응답:
 * <VIBE_FILE name=\"파일명\">
 * 파일 내용
 * </VIBE_FILE>
 * <VIBE_TYPE>html|react|vue</VIBE_TYPE>
 * <VIBE_EXPLANATION>프로젝트 설명</VIBE_EXPLANATION>
 * 
 * 스트리밍 중 부분 파싱도 지원 (완성되지 않은 형식도 처리)
 * Vue (.vue), React (.jsx/.tsx) 파일 확장자로 프로젝트 타입 자동 감지
 * 
 * @param raw - 파싱할 원본 AI 응답 텍스트
 * @returns {{ files, explanation, projectType }} 파일 객체, 설명, 감지된 프로젝트 타입
 */
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
