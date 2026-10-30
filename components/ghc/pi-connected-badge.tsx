"use client"

/**
 * Pi-connected badge — only after server verification (/api/identity/me).
 * Does not use client-only claims. Distinct from directory staking badge.
 */

import { useEffect, useState } from "react"
import { BadgeCheck } from "lucide-react"

type IdentityMe = {
  ok?: boolean
  serverVerified?: boolean
  piUsername?: string | null
  greenHavenId?: string | null
}

export function PiConnectedBadge({
  className = "",
  showUsername = true,
}: {
  className?: string
  showUsername?: boolean
}) {
  const [me, setMe] = useState<IdentityMe | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/identity/me", {
          credentials: "include",
          cache: "no-store",
        })
        const data = (await res.json().catch(() => ({}))) as IdentityMe
        if (!cancelled && res.ok && data.ok) setMe(data)
        else if (!cancelled) setMe({ ok: false, serverVerified: false })
      } catch {
        if (!cancelled) setMe({ ok: false, serverVerified: false })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!me?.serverVerified) return null

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-900 ring-1 ring-inset ring-violet-200 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800 ${className}`}
      title="Pi identity verified by GreenHaven server"
    >
      <BadgeCheck className="h-3 w-3" aria-hidden />
      {showUsername && me.piUsername ? `@${me.piUsername}` : "Pi connected"}
    </span>
  )
}

/** Compact identity strip for profile / settings */
export function PioneerIdentityStrip({ className = "", hideGreenHavenId = false }: { className?: string; hideGreenHavenId?: boolean }) {
  const [me, setMe] = useState<{
    greenHavenId?: string | null
    piUsername?: string | null
    serverVerified?: boolean
    piOnlyCommerce?: boolean
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/identity/me", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.ok) setMe(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!me) return null

  return (
    <div className={`rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-[11px] ${className}`}>
      <p className="font-semibold text-foreground">
        {me.serverVerified ? "Verified Pioneer account" : "Signed in"}
      </p>
      <p className="mt-0.5 text-muted-foreground">
        {!hideGreenHavenId && me.greenHavenId ? (
          <>
            GreenHaven ID <span className="font-mono font-bold text-foreground">{me.greenHavenId}</span>
          </>
        ) : null}
        {!hideGreenHavenId && me.greenHavenId && me.piUsername ? " · " : null}
        {me.piUsername ? (
          <>
            Pi <span className="font-semibold text-foreground">@{me.piUsername}</span>
          </>
        ) : null}
      </p>
      {me.piOnlyCommerce ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Commerce fees settle in π. GHC is earned (claims, referrals, missions) — not used for listing fees.
        </p>
      ) : null}
    </div>
  )
}
