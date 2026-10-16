"use client"

/**
 * Operator-facing foundation status (Step 1).
 * Fetches /api/health — no secrets. Safe to show under Settings → About.
 * Does not block the app; only informs when config/durability is incomplete.
 */

import { useEffect, useState } from "react"
import { Activity, AlertTriangle, CheckCircle2, XCircle } from "lucide-react"

type HealthBody = {
  status?: "ready" | "degraded" | "not_ready"
  ready?: boolean
  environment?: {
    isProduction?: boolean
    piSandbox?: boolean
    networkLabel?: string
  }
  blockers?: string[]
  warnings?: string[]
  checks?: Array<{
    id: string
    label: string
    status: string
    severity?: string
  }>
}

export function FoundationStatusCard() {
  const [data, setData] = useState<HealthBody | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store", credentials: "include" })
        const json = (await res.json().catch(() => ({}))) as HealthBody
        if (!cancelled) {
          setData(json)
          if (!res.ok && res.status !== 503) {
            setError(`Health HTTP ${res.status}`)
          }
        }
      } catch {
        if (!cancelled) setError("Could not reach /api/health")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (error && !data) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
        <p className="font-semibold">Foundation status unavailable</p>
        <p className="mt-1 text-amber-800/90">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-muted/40 p-3 text-[12px] text-muted-foreground">
        Checking foundation readiness…
      </div>
    )
  }

  const status = data.status || "degraded"
  const Icon =
    status === "ready" ? CheckCircle2 : status === "not_ready" ? XCircle : AlertTriangle
  const tone =
    status === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : status === "not_ready"
        ? "border-rose-200 bg-rose-50 text-rose-900"
        : "border-amber-200 bg-amber-50 text-amber-900"

  const blockers = data.blockers || []
  const warnings = data.warnings || []

  return (
    <div className={`rounded-xl border p-3 text-[12px] ${tone}`}>
      <div className="flex items-center gap-2 font-bold">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          Foundation: {status === "ready" ? "Ready" : status === "not_ready" ? "Not ready" : "Degraded"}
        </span>
        <Activity className="ml-auto h-3.5 w-3.5 opacity-60" aria-hidden />
      </div>
      <p className="mt-1.5 opacity-90">
        Network:{" "}
        <span className="font-semibold">
          {data.environment?.networkLabel ||
            (data.environment?.piSandbox ? "sandbox-testnet" : "mainnet")}
        </span>
        {data.environment?.isProduction ? " · production" : " · non-production"}
      </p>
      {blockers.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {blockers.slice(0, 4).map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      {status === "ready" && warnings.length > 0 ? (
        <p className="mt-2 opacity-80">Warnings: {warnings.length} (non-blocking)</p>
      ) : null}
      {status !== "ready" ? (
        <p className="mt-2 opacity-80">
          Ops: open <code className="rounded bg-black/5 px-1">/api/health</code> and see{" "}
          <code className="rounded bg-black/5 px-1">docs/FOUNDATION_READINESS.md</code>
        </p>
      ) : (
        <p className="mt-2 opacity-80">Release gate passed for this deployment.</p>
      )}
    </div>
  )
}
