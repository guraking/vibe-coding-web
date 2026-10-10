/**
 * 애플리케이션 진입점 (Entry Point)
 * React DOM에 애플리케이션을 렌더링합니다.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { IconContext } from '@phosphor-icons/react'
import './index.css'  // 전역 스타일시트 로드
import App from './App.tsx'  // 메인 앱 컴포넌트

// React 18 createRoot API를 사용하여 DOM에 앱 렌더링
// StrictMode는 개발 시 잠재적인 문제를 감지하는 데 도움 을 줍니다.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 앱 전체 아이콘 굵기. 채움(fill) 등 다른 굵기는 아이콘마다 weight 로 덮어쓴다. */}
    <IconContext.Provider value={{ weight: 'bold' }}>
      <App />
    </IconContext.Provider>
  </StrictMode>,
)
