import Anthropic from '@anthropic-ai/sdk'

// 사용자가 메시지에 넣은 이미지. data 는 data URL 접두어를 뺀 base64 본문이다.
export interface MessageImage {
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
  data: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  files?: Record<string, string>
  projectType?: 'html' | 'react' | 'vue'
  images?: MessageImage[]
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  limitPerMin: number
  remainingPerMin: number
  resetInSeconds: number
}

export interface AIModel {
  id: string
  label: string
  // 서버 측 refusal fallback 지원 여부. Haiku 는 지원하지 않는다.
  fallback: boolean
  // 100만 토큰당 USD 단가. 예상 비용 표시에만 쓴다.
  inputPerMTok: number
  outputPerMTok: number
  // 프롬프트가 overTokens 를 넘으면 입·출력 단가에 multiplier 를 곱한다.
  longPrompt?: { overTokens: number; multiplier: number }
}

// 첫 항목이 기본 모델이다.
// 단가 출처: Anthropic 공식 가격표(2026-10 기준). 가격이 바뀌면 여기만 고친다.
export const MODELS: AIModel[] = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', fallback: true, inputPerMTok: 2, outputPerMTok: 10 },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', fallback: true, inputPerMTok: 4, outputPerMTok: 20 },
  // Haiku 5.5 는 프롬프트 10만 토큰 초과 시 $0.50 / $2.50 (5배)
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', fallback: false, inputPerMTok: 0.1, outputPerMTok: 0.5, longPrompt: { overTokens: 100_000, multiplier: 5 } },
]

const SYSTEM_PROMPT = `You are Vibe Coding AI — an expert frontend developer who builds beautiful multi-file web projects instantly from natural language.

If the user is chatting or asking a question rather than requesting something to build or change, reply in plain Korean text with no VIBE tags.

## File downloads
When the user asks for a file or document (Excel, CSV, PDF, Word, PowerPoint, image, JSON, text, ZIP),
build the page that shows the content AND a visible download button that saves a real file.
Load libraries by <script> in index.html with these exact URLs:
- Excel (.xlsx): https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js  (XLSX.writeFile)
- PDF: https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js
  (render an HTML element; never jsPDF text APIs — their built-in fonts cannot draw Korean)
- Word (.docx): https://unpkg.com/docx@8.5.0/build/index.umd.js  (docx.Packer.toBlob)
- PowerPoint (.pptx): https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js  (pptx.writeFile)
- ZIP: https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
- CSV / JSON / TXT / SVG: no library — new Blob + <a download>. Prefix CSV with "\\uFEFF" so Excel reads Korean.
- PNG image: canvas.toBlob, or html2canvas for an HTML area.
Use Korean file names that describe the content (e.g. "매출표.xlsx").

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
 * Claude 스트리밍 코드 생성
 *
 * 텍스트 델타만 순서대로 yield 하고, 응답이 끝나면 토큰 사용량을 onUsage 로 한 번 넘긴다.
 * currentFiles 가 있으면 리파인 요청으로 보고 현재 파일 전체를 system 에 붙인다.
 * stop_reason 이 refusal 이면(fallback 모델까지 거절한 경우) Error 를 던진다.
 *
 * @param apiKey - Anthropic API 키. 서버 없는 정적 사이트라 사용자 본인 키로 브라우저에서 직접 호출한다.
 * @param model - MODELS 의 모델 ID
 */
export async function* streamCode(
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

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const useFallback = MODELS.find((m) => m.id === model)?.fallback ?? false
  const stream = client.beta.messages.stream({
    model,
    // 멀티 파일 프로젝트 전체를 한 응답에 담으므로 넉넉히 잡는다. 스트리밍이라 HTTP 타임아웃 대상이 아니다.
    max_tokens: 64000,
    system: SYSTEM_PROMPT + currentContext,
    // 이미지가 있는 메시지는 이미지 블록들 뒤에 텍스트를 둔다(이미지를 먼저 두는 것이 권장 순서).
    // 이전 턴의 이미지도 매번 다시 보내야 Claude 가 그 이미지를 참조할 수 있다.
    messages: messages.map((m) => ({
      role: m.role,
      content: m.images?.length
        ? [
            ...m.images.map((img) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: img.mediaType, data: img.data },
            })),
            { type: 'text' as const, text: m.content },
          ]
        : m.content,
    })),
    ...(useFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  })

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') yield event.delta.text
  }

  const final = await stream.finalMessage()
  if (final.stop_reason === 'refusal') {
    const reason = final.stop_details?.explanation
    throw new Error(reason ? `Claude가 요청을 거절했습니다: ${reason}` : 'Claude가 요청을 거절했습니다')
  }
  onUsage?.({
    promptTokens: final.usage.input_tokens,
    completionTokens: final.usage.output_tokens,
    totalTokens: final.usage.input_tokens + final.usage.output_tokens,
    // Anthropic rate limit 헤더는 브라우저 CORS 에 노출되지 않으므로 -1(표시 안 함)로 둔다.
    limitPerMin: -1,
    remainingPerMin: -1,
    resetInSeconds: -1,
  })
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
