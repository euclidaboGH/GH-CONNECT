"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, RefreshCw, ShieldCheck, LifeBuoy } from "lucide-react"

/** Recoverable route error. Never render raw server exceptions or request secrets. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [online, setOnline] = useState(true)
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const correlationId = typeof error?.digest === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(error.digest)
    ? error.digest
    : "unavailable"

  useEffect(() => {
    // Never mirror raw exception messages into the browser console. The digest
    // is sufficient for correlating this boundary with server-side diagnostics.
    console.error("[app/error]", correlationId)
    const updateOnline = () => setOnline(navigator.onLine)
    titleRef.current?.focus({ preventScroll: true })
    updateOnline()
    window.addEventListener("online", updateOnline)
    window.addEventListener("offline", updateOnline)
    return () => {
      window.removeEventListener("online", updateOnline)
      window.removeEventListener("offline", updateOnline)
    }
  }, [correlationId])

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--gh-ref-canvas,#f6f8f7)] px-5 py-10 text-foreground">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,.12),transparent_58%)]" />
      <section role="alert" aria-labelledby="error-title" className="relative w-full max-w-md rounded-[1.75rem] border border-border/80 bg-card/95 p-6 text-center shadow-[0_24px_70px_rgba(10,40,28,.10)] backdrop-blur sm:p-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-300">
          <AlertTriangle size={29} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <p className="text-xs font-extrabold uppercase tracking-[.2em] text-primary">GreenHaven</p>
        <h1 ref={titleRef} tabIndex={-1} id="error-title" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 mt-2 text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">We hit a temporary issue</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          GreenHaven couldn’t finish loading this screen. Retry this route first. If it keeps failing, open Support and share the reference below. Check pending actions before submitting them again.
        </p>
        {!online && (
          <p role="status" className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-800 dark:text-amber-200">
            You appear to be offline. Reconnect before retrying this screen.
          </p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Support reference: <code className="rounded bg-muted px-1.5 py-0.5 font-mono" data-testid="error-correlation-id">{correlationId}</code>
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-105 active:scale-[.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
          >
            <RefreshCw size={16} aria-hidden="true" /> Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-bold text-foreground transition hover:bg-muted active:scale-[.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
          >
            Reload this screen <ArrowRight size={16} aria-hidden="true" />
          </button>
          <Link href="/support" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-bold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none">
            <LifeBuoy size={16} aria-hidden="true" /> Support
          </Link>
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 border-t border-border/70 pt-4 text-[11px] font-medium text-muted-foreground">
          <ShieldCheck size={14} aria-hidden="true" /> Your account safety remains a priority
        </div>
      </section>
    </main>
  )
}
