"use client"

import { useEffect } from "react"

/** Route-level error boundary. Shows a recoverable screen; never exposes error details. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[app/error]", error?.digest ?? "", error?.message)
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <p className="text-sm font-semibold tracking-wide text-emerald-600">GreenHaven</p>
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        We hit an unexpected problem. Your data is safe. Try again, or reload the app.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--gh-green)] px-5 text-sm font-bold text-white"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.replace("/")}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-bold"
        >
          Reload app
        </button>
      </div>
    </main>
  )
}
