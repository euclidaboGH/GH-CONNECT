"use client"

import { useEffect, useRef, useState } from "react"

/** Last-resort boundary for root layout failures. Must render its own <html>/<body>. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const [online, setOnline] = useState(true)
  const correlationId = typeof error?.digest === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(error.digest)
    ? error.digest
    : "unavailable"

  useEffect(() => {
    console.error("[app/global-error]", correlationId)
    titleRef.current?.focus({ preventScroll: true })
    const updateOnline = () => setOnline(navigator.onLine)
    updateOnline()
    window.addEventListener("online", updateOnline)
    window.addEventListener("offline", updateOnline)
    return () => {
      window.removeEventListener("online", updateOnline)
      window.removeEventListener("offline", updateOnline)
    }
  }, [correlationId])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#ffffff",
          color: "#17133B",
        }}
      >
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#079447" }}>GreenHaven</p>
        <h1 ref={titleRef} tabIndex={-1} style={{ margin: 0, fontSize: 24, outlineOffset: 4 }}>Something went wrong</h1>
        <p style={{ margin: 0, maxWidth: 360, fontSize: 14, color: "#6B6880" }}>
          GreenHaven could not finish loading. Please try again. If this continues, open Support and share the reference below. Check pending actions before submitting them again.
        </p>
        {!online && <p role="status" style={{ margin: 0, maxWidth: 360, fontSize: 14, color: "#92400e" }}>You appear to be offline. Reconnect before retrying this screen.</p>}
        <p style={{ margin: 0, fontSize: 12, color: "#6B6880" }}>
          Support reference: <code>{correlationId}</code>
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            minHeight: 44,
            padding: "0 20px",
            border: 0,
            borderRadius: 999,
            background: "#079447",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            outlineOffset: 3,
          }}
        >
          Try again
        </button>
        <a href="/support" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 20px", border: "1px solid #d8d8df", borderRadius: 999, color: "inherit", textDecoration: "none", fontWeight: 700, fontSize: 14, outlineOffset: 3 }}>
          Open Support
        </a>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ minHeight: 44, padding: "0 20px", border: "1px solid #d8d8df", borderRadius: 999, background: "transparent", color: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
        >
          Reload app
        </button>
        </div>
      </body>
    </html>
  )
}
