"use client"

/**
 * Phase 2 — transparent GHC utility sinks (boosts & tools).
 * Prices from server catalog only; spend via /api/economy/utility.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Sparkles, Zap, Store, Users, Wand2, RefreshCw, ShieldCheck, X } from "lucide-react"
import { ASSET_POLICY } from "@/lib/asset-separation"

type CatalogItem = {
  purpose: string
  amountGhc: number
  amountPi?: number
  description: string
  category: string
  durationHours?: number
  available?: boolean
  unavailableReason?: string
}

type SupplySnap = {
  caps?: { activityDailyGhc?: number; activityWeeklyGhc?: number }
  processTelemetry?: { sinks?: number; userIssuance?: number; eventCount?: number }
  principles?: string[]
  population?: { eligibleUsers?: number; activeClaimers?: number } | null
}

function iconFor(purpose: string) {
  if (purpose.includes("listing")) return Store
  if (purpose.includes("community")) return Users
  if (purpose.includes("creator") || purpose.includes("studio")) return Wand2
  if (purpose.includes("spotlight")) return Sparkles
  return Zap
}

export function GhcUtilityPanel({
  onToast,
  compact,
}: {
  onToast?: (msg: string, type?: "success" | "error" | "info") => void
  compact?: boolean
}) {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [supply, setSupply] = useState<SupplySnap | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [targetId, setTargetId] = useState("")
  const [confirmItem, setConfirmItem] = useState<CatalogItem | null>(null)
  const requestKeys = useRef(new Map<string, string>())

  const needsTarget = (purpose: string) => ["boost_post", "boost_profile", "boost_listing", "feed_spotlight"].includes(purpose)
  const createRequestKey = () => {
    try {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `utility_${crypto.randomUUID()}`
    } catch { /* use fallback */ }
    return `utility_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`
  }

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [cRes, sRes] = await Promise.all([
        fetch("/api/economy/catalog?utility=1", { credentials: "include" }),
        fetch("/api/economy/supply", { credentials: "include" }),
      ])
      const c = (await cRes.json().catch(() => ({}))) as { items?: CatalogItem[]; ok?: boolean; message?: string }
      const s = (await sRes.json().catch(() => ({}))) as SupplySnap & { ok?: boolean }
      if (!cRes.ok || c.ok === false || !Array.isArray(c.items)) {
        setItems([])
        setLoadError(c.message || "Could not load the GHC utility catalog.")
      } else {
        setItems(c.items)
        setSupply(sRes.ok ? s : null)
      }
    } catch {
      setItems([])
      setLoadError("Network error while loading Spend GHC. Your balance has not been changed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const purchase = async (item: CatalogItem) => {
    const purpose = item.purpose
    const target = targetId.trim()
    if (busy || item.available === false) return
    if (needsTarget(purpose) && !target) {
      onToast?.("Enter the target ID before continuing.", "error")
      return
    }
    const keyScope = `${purpose}:${target}`
    if (!requestKeys.current.has(keyScope)) requestKeys.current.set(keyScope, createRequestKey())
    const clientRequestId = requestKeys.current.get(keyScope)!
    setBusy(purpose)
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      try {
        const { IdentityService } = await import("@/lib/identity/identity-service")
        Object.assign(headers, IdentityService.getAuthHeaders?.() || {})
      } catch {
        /* */
      }
      const res = await fetch("/api/economy/utility", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          purpose,
          targetId: target || undefined,
          clientRequestId,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        amountGhc?: number
        expiresAt?: string
        message?: string
        retryable?: boolean
      }
      if (!res.ok || !data.ok) {
        const msg =
          data.error === "INSUFFICIENT_BALANCE"
            ? "Insufficient available GHC"
            : data.error || data.message || "Purchase failed"
        onToast?.(msg, "error")
        return
      }
      requestKeys.current.delete(keyScope)
      setConfirmItem(null)
      onToast?.(
        `Spent ₲ ${data.amountGhc ?? ""} · ${purpose.replace(/_/g, " ")}${
          data.expiresAt ? ` · until ${new Date(data.expiresAt).toLocaleString()}` : ""
        }`,
        "success",
      )
      try {
        window.dispatchEvent(new CustomEvent("ghc:wallet-synced"))
        try { window.dispatchEvent(new CustomEvent("ghc:utility-spent", { detail: { purpose } })) } catch { /* */ }
      } catch {
        /* */
      }
      void load()
    } catch {
      onToast?.("Network error", "error")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section
      className={compact ? "space-y-3" : "mx-3 mt-4 space-y-3"}
      aria-label="GHC utility catalog"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
        <h2 className="text-[13px] font-bold text-foreground">Spend GHC · utility</h2>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          Server-priced boosts and tools. Debits available balance only.{" "}
          {ASSET_POLICY.dualRailCopy}
        </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || !!busy} aria-label="Refresh GHC utility catalog" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card text-muted-foreground hover:bg-muted disabled:opacity-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {supply?.caps ? (
        <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          <p className="font-semibold text-foreground">Issuance caps (network)</p>
          <p className="mt-0.5">
            Activity ≤ ₲ {supply.caps.activityDailyGhc}/day · ₲ {supply.caps.activityWeeklyGhc}/week
            {supply.population?.eligibleUsers != null
              ? ` · ~${supply.population.eligibleUsers} eligible users`
              : ""}
          </p>
          {supply.processTelemetry ? (
            <p className="mt-0.5">
              Process sinks ₲ {Number(supply.processTelemetry.sinks || 0).toFixed(2)} · issuance ₲{" "}
              {Number(supply.processTelemetry.userIssuance || 0).toFixed(2)}
            </p>
          ) : null}
        </div>
      ) : null}

      <label className="block">
        <span className="text-[11px] font-bold text-muted-foreground">
          Target id (required for post, profile, listing, or spotlight boosts)
        </span>
        <input
          value={targetId}
          onChange={(e) => setTargetId(e.target.value.slice(0, 120))}
          placeholder="e.g. post id"
          className="mt-1 w-full rounded-xl border border-border/70 bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
      </label>

      {loadError ? (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50/70 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100" role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={() => void load()} disabled={loading} className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-full border border-current/20 px-3 text-xs font-semibold disabled:opacity-50"><RefreshCw size={13} /> Try again</button>
        </div>
      ) : loading ? (
        <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading catalog…
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Catalog unavailable.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = iconFor(item.purpose)
            const isBusy = busy === item.purpose
            return (
              <li
                key={item.purpose}
                className="flex items-start gap-3 rounded-2xl border border-border/50 bg-card px-3 py-3 shadow-sm"
              >
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
                  <Icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-foreground">
                    {item.purpose.replace(/_/g, " ")}
                  </p>
                  <p className="text-[11px] leading-snug text-muted-foreground">{item.description}</p>
                  {item.available === false && item.unavailableReason ? (
                    <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">{item.unavailableReason}</p>
                  ) : null}
                  <p className="mt-1 text-[12px] font-semibold tabular-nums text-foreground">
                    ₲ {item.amountGhc}
                    {item.amountPi != null ? (
                      <span className="ml-2 font-medium text-violet-700 dark:text-violet-300">
                        or {item.amountPi} π
                      </span>
                    ) : null}
                    {item.durationHours ? (
                      <span className="ml-2 text-[10px] font-medium text-muted-foreground">
                        · {item.durationHours}h
                      </span>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!!busy || item.available === false}
                  onClick={() => {
                    if (item.available === false) return
                    if (needsTarget(item.purpose) && !targetId.trim()) {
                      onToast?.("Enter the target ID before continuing.", "error")
                      return
                    }
                    setConfirmItem(item)
                  }}
                  className="shrink-0 rounded-full bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
                >
                  {isBusy ? <Loader2 size={14} className="animate-spin" /> : item.available === false ? "Unavailable" : "Buy"}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {confirmItem ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="ghc-utility-confirm-title" className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:rounded-3xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700"><ShieldCheck size={19} /></span>
              <div className="min-w-0 flex-1">
                <h3 id="ghc-utility-confirm-title" className="text-base font-bold">Review GHC spend</h3>
                <p className="mt-1 text-sm text-muted-foreground">{confirmItem.description}</p>
              </div>
              <button type="button" onClick={() => setConfirmItem(null)} disabled={!!busy} aria-label="Cancel spend" className="rounded-full p-2 hover:bg-muted disabled:opacity-50"><X size={17} /></button>
            </div>
            <div className="mt-4 rounded-2xl border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">Price (server catalog)</span><strong className="tabular-nums">₲ {confirmItem.amountGhc}</strong></div>
              {needsTarget(confirmItem.purpose) ? <div className="mt-2 flex items-start justify-between gap-3 text-sm"><span className="text-muted-foreground">Target</span><span className="max-w-[65%] break-all text-right font-medium">{targetId.trim()}</span></div> : null}
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Only the available GHC balance can be spent. If the request times out, retrying the same action uses the same request key to help prevent duplicate charges.</p>
            </div>
            {confirmItem.available === false ? <p className="mt-3 text-sm text-amber-700">This utility is not currently available; no GHC will be charged.</p> : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmItem(null)} disabled={!!busy} className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => void purchase(confirmItem)} disabled={!!busy || confirmItem.available === false} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-bold text-white disabled:opacity-50">{busy === confirmItem.purpose ? <Loader2 size={15} className="animate-spin" /> : null}{busy ? "Processing…" : "Confirm spend"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
