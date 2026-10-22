"use client"

/**
 * Phase 2 — transparent GHC utility sinks (boosts & tools).
 * Prices from server catalog only; spend via /api/economy/utility.
 */

import { useCallback, useEffect, useState } from "react"
import { Loader2, Sparkles, Zap, Store, Users, Wand2 } from "lucide-react"
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
  const [busy, setBusy] = useState<string | null>(null)
  const [targetId, setTargetId] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, sRes] = await Promise.all([
        fetch("/api/economy/catalog?utility=1", { credentials: "include" }),
        fetch("/api/economy/supply", { credentials: "include" }),
      ])
      const c = (await cRes.json().catch(() => ({}))) as { items?: CatalogItem[] }
      const s = (await sRes.json().catch(() => ({}))) as SupplySnap & { ok?: boolean }
      setItems(Array.isArray(c.items) ? c.items : [])
      setSupply(s)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const purchase = async (purpose: string) => {
    if (busy) return
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
          targetId: targetId.trim() || undefined,
          clientRequestId: `util-${purpose}-${Date.now()}`,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        amountGhc?: number
        expiresAt?: string
        message?: string
      }
      if (!res.ok || !data.ok) {
        const msg =
          data.error === "INSUFFICIENT_BALANCE"
            ? "Insufficient available GHC"
            : data.error || data.message || "Purchase failed"
        onToast?.(msg, "error")
        return
      }
      onToast?.(
        `Spent ₲ ${data.amountGhc ?? ""} · ${purpose.replace(/_/g, " ")}${
          data.expiresAt ? ` · until ${new Date(data.expiresAt).toLocaleString()}` : ""
        }`,
        "success",
      )
      try {
        window.dispatchEvent(new CustomEvent("ghc:wallet-synced"))
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
      <div>
        <h2 className="text-[13px] font-bold text-foreground">Spend GHC · utility</h2>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          Server-priced boosts and tools. Debits available balance only.{" "}
          {ASSET_POLICY.dualRailCopy}
        </p>
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
          Target id (optional · post / listing / profile)
        </span>
        <input
          value={targetId}
          onChange={(e) => setTargetId(e.target.value.slice(0, 120))}
          placeholder="e.g. post id"
          className="mt-1 w-full rounded-xl border border-border/70 bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
      </label>

      {loading ? (
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
                  onClick={() => void purchase(item.purpose)}
                  className="shrink-0 rounded-full bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
                >
                  {isBusy ? <Loader2 size={14} className="animate-spin" /> : item.available === false ? "Unavailable" : "Buy"}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
