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
    <div className="flex flex-col flex-1 overflow-hidden min-w-0" style={{ background: "#2b2b2b" }}>
      {/* Editor tab bar */}
      <div
        className="flex items-end flex-shrink-0"
        style={{ background: "#3c3f41", borderBottom: "1px solid #323232", height: 36 }}
      >
        {/* Tabs */}
        <button
          onClick={() => setTab("preview")}
          className="relative flex items-center gap-2 px-4 h-full text-xs transition-colors select-none"
          style={{
            background: tab === "preview" ? "#2b2b2b" : "transparent",
            color: tab === "preview" ? "#bababa" : "#808080",
            borderRight: "1px solid #4a4a4a",
            borderTop: tab === "preview" ? "2px solid #4e9aea" : "2px solid transparent",
          }}
        >
          <span style={{ color: "#cc7832", fontSize: 11 }}>◈</span>
          <span>index.html</span>
          {isLoading && tab === "preview" && (
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4e9aea" }} />
          )}
        </button>
        <button
          onClick={() => setTab("code")}
          className="relative flex items-center gap-2 px-4 h-full text-xs transition-colors select-none"
          style={{
            background: tab === "code" ? "#2b2b2b" : "transparent",
            color: tab === "code" ? "#bababa" : "#808080",
            borderRight: "1px solid #4a4a4a",
            borderTop: tab === "code" ? "2px solid #4e9aea" : "2px solid transparent",
          }}
        >
          <span style={{ color: "#ffc66d", fontSize: 11 }}>◈</span>
          <span>output.tsx</span>
        </button>

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-3 px-3 h-full">
          {isLoading && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "#4e9aea" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: "#4e9aea" }} />
              생성 중...
            </span>
          )}
          {code && tab === "code" && (
            <button
              onClick={copyCode}
              className="text-xs px-2.5 py-1 rounded transition-colors"
              style={{
                background: copied ? "rgba(73,156,84,0.2)" : "#4c5052",
                color: copied ? "#5aad63" : "#a9b7c6",
                border: `1px solid ${copied ? "rgba(73,156,84,0.4)" : "#5c6164"}`,
              }}
              onMouseEnter={e => { if (!copied) e.currentTarget.style.background = "#5c6164" }}
              onMouseLeave={e => { if (!copied) e.currentTarget.style.background = "#4c5052" }}
            >
              {copied ? "✓ 복사됨" : "복사"}
            </button>
          )}
          {code && tab === "preview" && (
            <button
              onClick={openInNewTab}
              className="text-xs px-2.5 py-1 rounded transition-colors"
              style={{ background: "#4c5052", color: "#a9b7c6", border: "1px solid #5c6164" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#5c6164")}
              onMouseLeave={e => (e.currentTarget.style.background = "#4c5052")}
            >
              ↗ 새 탭
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {/* Preview tab */}
        <div className={`absolute inset-0 flex flex-col ${tab === "preview" ? "" : "hidden"}`}>
          {html ? (
            <iframe
              srcDoc={html}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
              title="Preview"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-5" style={{ background: "#2b2b2b" }}>
              <div className="text-center">
                <div
                  className="w-16 h-16 mx-auto mb-5 rounded-xl flex items-center justify-center text-3xl"
                  style={{ background: "#313335", border: "1px solid #4a4a4a" }}
                >
                  ⚡
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: "#a9b7c6" }}>
                  아직 생성된 화면이 없습니다
                </p>
                <p className="text-xs" style={{ color: "#606366" }}>
                  왼쪽 채팅에서 만들고 싶은 것을 설명하세요
                </p>
              </div>
              <div
                className="px-4 py-3 rounded-lg text-xs font-mono"
                style={{ background: "#313335", border: "1px solid #4a4a4a", color: "#606366", lineHeight: 1.8 }}
              >
                <div><span style={{ color: "#cc7832" }}>fun </span><span style={{ color: "#ffc66d" }}>main</span><span style={{ color: "#a9b7c6" }}>()</span><span style={{ color: "#a9b7c6" }}> {"{"}</span></div>
                <div><span style={{ color: "#808080" }}>{"  // "}</span><span style={{ color: "#808080" }}>아직 생성된 코드가 없습니다</span></div>
                <div><span style={{ color: "#a9b7c6" }}>{"}"}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Code tab */}
        <div
          className={`absolute inset-0 overflow-auto ${tab === "code" ? "block" : "hidden"}`}
          style={{ background: "#2b2b2b" }}
        >
          {code ? (
            <table className="w-full border-collapse">
              <tbody>
                {code.split("\n").map((line, i) => (
                  <tr
                    key={i}
                    className="leading-5 transition-colors"
                    style={{ background: "transparent" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#313335")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td
                      className="text-right select-none align-top text-xs font-mono"
                      style={{ color: "#606366", minWidth: 48, padding: "1px 16px 1px 8px", borderRight: "1px solid #3c3f41" }}
                    >
                      {i + 1}
                    </td>
                    <td
                      className="align-top text-xs whitespace-pre-wrap break-words font-mono"
                      style={{ color: "#a9b7c6", padding: "1px 8px" }}
                    >
                      {line || " "}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex items-center justify-center h-full text-xs" style={{ color: "#606366" }}>
              아직 생성된 코드가 없습니다
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-3 flex-shrink-0 text-xs select-none"
        style={{ height: 22, background: "#3c3f41", borderTop: "1px solid #323232", color: "#808080" }}
      >
        <div className="flex items-center gap-4">
          <span style={{ color: "#4e9aea" }}>⚡</span>
          {isLoading && <span style={{ color: "#ffc66d" }}>● AI 생성 중...</span>}
        </div>
        <div className="flex items-center gap-4">
          <span>UTF-8</span>
          <span>HTML</span>
          {code && <span>Ln 1, Col 1</span>}
        </div>
      </div>
    </div>
  )
}