"use client"

import { useEffect } from "react"

/** Last-resort boundary for root layout failures. Must render its own <html>/<body>. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[app/global-error]", error?.digest ?? "", error?.message)
  }, [error])

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
          color: "#0a0a0a",
        }}
      >
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#059669" }}>GreenHaven</p>
        <h1 style={{ margin: 0, fontSize: 24 }}>Something went wrong</h1>
        <p style={{ margin: 0, maxWidth: 360, fontSize: 14, color: "#525252" }}>
          The app failed to load. Your data is safe. Please try again.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            minHeight: 44,
            padding: "0 20px",
            border: 0,
            borderRadius: 999,
            background: "#059669",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
