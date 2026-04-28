# Vibe Coding Web

AI 기반 프론트엔드 코드 생성 웹 애플리케이션입니다. 자연어로 설명하면 HTML / React / Vue 프로젝트를 즉시 생성하고 실시간으로 미리볼 수 있습니다.

## 주요 기능

- **자연어 → 코드 생성** — Groq / ChatGPT / Gemini API를 이용해 멀티 파일 웹 프로젝트를 자동 생성
- **실시간 미리보기** — 생성된 HTML / React / Vue 앱을 iframe에서 즉시 확인
- **3가지 프로젝트 타입** — HTML+CSS+JS, React(Vite), Vue 3(Vite) 지원
- **대화형 수정** — 채팅 이력을 유지하면서 프로젝트를 반복적으로 개선
- **내보내기 / 가져오기** — 생성된 파일을 ZIP으로 다운로드하거나 ZIP을 불러와 수정
- **모바일 지원** — 반응형 레이아웃으로 모바일에서도 사용 가능
- **PWA 지원** — 서비스 워커를 통한 오프라인 캐싱

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | React 18 + TypeScript |
| 빌드 도구 | Vite 6 |
| 스타일링 | Tailwind CSS |
| AI API | [Groq](https://groq.com), [OpenAI(ChatGPT)](https://platform.openai.com), [Google Gemini](https://ai.google.dev) |
| 아이콘 | lucide-react |

## 시작하기

### 1. 저장소 클론

```bash
git clone https://github.com/guraking/vibe-coding-web.git
cd vibe-coding-web
```

### 2. 의존성 설치

```bash
npm install
```

### 3. API 키 설정

[Groq Console](https://console.groq.com), [OpenAI Platform](https://platform.openai.com), [Google AI Studio](https://aistudio.google.com)에서 API 키를 발급받은 후 `.env.local` 파일을 생성합니다.

```env
VITE_GROQ_API_KEY=gsk_your_key_here
VITE_OPENAI_API_KEY=sk_your_key_here
VITE_GEMINI_API_KEY=AIza_your_key_here
```

> `.env.local`이 없으면 앱 실행 후 설정 버튼에서 공급자별 키를 직접 입력할 수 있습니다.

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173`을 열면 됩니다.

### 5. 프로덕션 빌드

```bash
npm run build
```

## 사용 방법

1. 상단에서 AI 공급자(Groq / ChatGPT / Gemini)를 선택하고 모델을 선택합니다.
2. 설정 모달에서 공급자별 API 키를 각각 저장합니다.
3. 채팅 입력창에 만들고 싶은 앱을 한국어 또는 영어로 설명합니다.
4. 우측 미리보기 패널에서 결과를 확인하고, 추가 수정 요청을 입력합니다.
5. 완성된 프로젝트는 내보내기(Export) 버튼으로 ZIP 파일로 다운로드할 수 있습니다.

## 라이선스

MIT
