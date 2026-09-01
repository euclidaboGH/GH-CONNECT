"use client"

import Link from "next/link"
import { useEffect } from "react"

/**
 * Friendly fallback when a path is missing (App Studio / deep links).
 * Soft-redirect to home so users are not stuck on a blank 404.
 */
export default function NotFound() {
  useEffect(() => {
    // App Studio sometimes opens a non-root path after upload — recover to home.
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      const t = window.setTimeout(() => {
        window.location.replace("/")
      }, 400)
      return () => window.clearTimeout(t)
    }
  }, [])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <p className="text-sm font-semibold tracking-wide text-emerald-600">GreenHaven</p>
      <h1 className="text-2xl font-bold">Taking you home…</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This path is not used. Opening the main app.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-bold text-white"
      >
        Open GreenHaven
      </Link>
    </main>
  )
}
