"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

/** A recoverable not-found state. Do not silently redirect: preserve the URL
 * context so users can understand a broken link and choose how to recover. */
export default function NotFound() {
  const router = useRouter()
  const homeRef = useRef<HTMLAnchorElement | null>(null)

  useEffect(() => {
    homeRef.current?.focus()
  }, [])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 py-10 text-center text-foreground" aria-labelledby="not-found-title">
      <p className="text-sm font-semibold tracking-wide text-emerald-600">GreenHaven</p>
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card text-2xl font-black text-primary" aria-hidden="true">404</div>
      <h1 id="not-found-title" className="text-2xl font-bold">We couldn’t find that page</h1>
      <p className="max-w-sm text-sm leading-6 text-muted-foreground">This link may be outdated or unavailable. Your account and saved progress have not been changed.</p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Link ref={homeRef} href="/" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--gh-green)] px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">Open GreenHaven</Link>
        <button type="button" onClick={() => {
          if (typeof window !== "undefined" && window.history.length > 1) router.back()
          else router.push("/")
        }} className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">Go back</button>
      </div>
    </main>
  )
}
