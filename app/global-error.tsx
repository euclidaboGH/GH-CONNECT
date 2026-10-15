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
          color: "#17133B",
        }}
      >
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#079447" }}>GreenHaven</p>
        <h1 style={{ margin: 0, fontSize: 24 }}>Something went wrong</h1>
        <p style={{ margin: 0, maxWidth: 360, fontSize: 14, color: "#6B6880" }}>
          GreenHaven could not finish loading. Please try again.
        </p>
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
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
