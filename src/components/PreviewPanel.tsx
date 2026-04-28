import { useState } from "react"

interface Props {
  html: string
  code: string
  isLoading: boolean
}

type Tab = "preview" | "code"

export default function PreviewPanel({ html, code, isLoading }: Props) {
  const [tab, setTab] = useState<Tab>("preview")
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openInNewTab = () => {
    const w = window.open("", "_blank")
    if (w) { w.document.write(html); w.document.close() }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-w-0" style={{ background: "#1e1f22" }}>
      {/* Editor tab bar */}
      <div
        className="flex items-end flex-shrink-0"
        style={{ background: "#2b2d30", borderBottom: "1px solid #282828", height: 36, paddingTop: 4 }}
      >
        {/* Tabs */}
        <button
          onClick={() => setTab("preview")}
          className="relative flex items-center gap-1.5 px-3 text-xs select-none transition-colors"
          style={{
            height: 32,
            background: tab === "preview" ? "#1e1f22" : "transparent",
            color: tab === "preview" ? "#bababa" : "#606366",
            borderTop: tab === "preview" ? "2px solid #4e9aea" : "2px solid transparent",
            borderRight: "1px solid #282828",
            borderRadius: "4px 4px 0 0",
          }}
          onMouseEnter={e => { if (tab !== "preview") e.currentTarget.style.color = "#9da4ac" }}
          onMouseLeave={e => { if (tab !== "preview") e.currentTarget.style.color = "#606366" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill={tab === "preview" ? "#cc7832" : "#606366"}>
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
            <polyline points="13 2 13 9 20 9" fill="none" stroke={tab === "preview" ? "#cc7832" : "#606366"} strokeWidth="2"/>
          </svg>
          <span>index.html</span>
          {isLoading && tab === "preview" && (
            <span className="w-1.5 h-1.5 rounded-full animate-pulse ml-1" style={{ background: "#4e9aea" }} />
          )}
          {tab === "preview" && <span className="ml-1.5 text-xs" style={{ color: "#606366", fontSize: 11 }}>×</span>}
        </button>

        <button
          onClick={() => setTab("code")}
          className="relative flex items-center gap-1.5 px-3 text-xs select-none transition-colors"
          style={{
            height: 32,
            background: tab === "code" ? "#1e1f22" : "transparent",
            color: tab === "code" ? "#bababa" : "#606366",
            borderTop: tab === "code" ? "2px solid #4e9aea" : "2px solid transparent",
            borderRight: "1px solid #282828",
            borderRadius: "4px 4px 0 0",
          }}
          onMouseEnter={e => { if (tab !== "code") e.currentTarget.style.color = "#9da4ac" }}
          onMouseLeave={e => { if (tab !== "code") e.currentTarget.style.color = "#606366" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill={tab === "code" ? "#ffc66d" : "#606366"}>
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
            <polyline points="13 2 13 9 20 9" fill="none" stroke={tab === "code" ? "#ffc66d" : "#606366"} strokeWidth="2"/>
          </svg>
          <span>output.tsx</span>
          {tab === "code" && <span className="ml-1.5 text-xs" style={{ color: "#606366", fontSize: 11 }}>×</span>}
        </button>

        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-1 px-2 pb-1">
          {isLoading && (
            <span className="flex items-center gap-1.5 text-xs mr-2" style={{ color: "#4e9aea" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: "#4e9aea" }} />
              생성 중...
            </span>
          )}
          {code && tab === "code" && (
            <button
              onClick={copyCode}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
              style={{
                background: copied ? "rgba(73,156,84,0.15)" : "transparent",
                color: copied ? "#499c54" : "#606366",
                border: `1px solid ${copied ? "rgba(73,156,84,0.3)" : "transparent"}`,
              }}
              onMouseEnter={e => { if (!copied) { e.currentTarget.style.background = "#2b2d30"; e.currentTarget.style.color = "#9da4ac" } }}
              onMouseLeave={e => { if (!copied) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#606366" } }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              {copied ? "복사됨" : "복사"}
            </button>
          )}
          {code && tab === "preview" && (
            <button
              onClick={openInNewTab}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
              style={{ background: "transparent", color: "#606366" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#2b2d30"; e.currentTarget.style.color = "#9da4ac" }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#606366" }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              새 탭
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden relative">
        {/* Preview */}
        <div className={`absolute inset-0 flex flex-col ${tab === "preview" ? "" : "hidden"}`}>
          {html ? (
            <iframe
              srcDoc={html}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
              title="Preview"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-6" style={{ background: "#1e1f22" }}>
              <div className="text-center">
                <div
                  className="w-14 h-14 mx-auto mb-4 rounded-lg flex items-center justify-center"
                  style={{ background: "#2b2d30", border: "1px solid #393b40" }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#4e9aea" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M2 17l10 5 10-5" stroke="#4e9aea" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M2 12l10 5 10-5" stroke="#4e9aea" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                  </svg>
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: "#9da4ac" }}>아직 생성된 화면이 없습니다</p>
                <p className="text-xs" style={{ color: "#4f5255" }}>왼쪽 채팅에서 만들고 싶은 것을 설명하세요</p>
              </div>
              {/* Fake code lines */}
              <div
                className="text-xs font-mono rounded-lg"
                style={{ background: "#2b2d30", border: "1px solid #393b40", padding: "12px 16px", lineHeight: 1.9, color: "#4f5255" }}
              >
                <div><span style={{ color: "#cc7832" }}>fun </span><span style={{ color: "#ffc66d" }}>main</span><span style={{ color: "#9da4ac" }}>()</span><span style={{ color: "#9da4ac" }}>{" {"}</span></div>
                <div><span style={{ color: "#606366" }}>{"    // "}</span><span>아직 생성된 코드가 없습니다</span></div>
                <div><span style={{ color: "#9da4ac" }}>{"}"}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Code view */}
        <div
          className={`absolute inset-0 overflow-auto ${tab === "code" ? "block" : "hidden"}`}
          style={{ background: "#1e1f22" }}
        >
          {code ? (
            <table className="w-full border-collapse">
              <tbody>
                {code.split("\n").map((line, i) => (
                  <tr
                    key={i}
                    className="leading-5 transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.background = "#26282e")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td
                      className="text-right select-none align-top text-xs font-mono"
                      style={{ color: "#4f5255", minWidth: 48, padding: "1px 16px 1px 8px", borderRight: "1px solid #2b2d30", userSelect: "none" }}
                    >{i + 1}</td>
                    <td
                      className="align-top text-xs whitespace-pre-wrap break-words font-mono"
                      style={{ color: "#9da4ac", padding: "1px 8px" }}
                    >{line || " "}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex items-center justify-center h-full text-xs" style={{ color: "#4f5255" }}>
              아직 생성된 코드가 없습니다
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-3 flex-shrink-0 text-xs select-none"
        style={{ height: 22, background: "#3c3f41", borderTop: "1px solid #282828", color: "#6f737a" }}
      >
        <div className="flex items-center gap-3">
          {/* breadcrumb */}
          <span style={{ color: "#9da4ac" }}>vibe-coding-web</span>
          <span style={{ color: "#43454a" }}>›</span>
          <span>src</span>
          <span style={{ color: "#43454a" }}>›</span>
          <span style={{ color: "#ffc66d" }}>index.html</span>
          {isLoading && <span className="ml-2" style={{ color: "#ffc66d" }}>● 생성 중...</span>}
        </div>
        <div className="flex items-center gap-3">
          <span>LF</span>
          <span>UTF-8</span>
          {code && <span>{code.split("\n").length} lines</span>}
        </div>
      </div>
    </div>
  )
}