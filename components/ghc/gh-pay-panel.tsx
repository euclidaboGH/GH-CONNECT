"use client"

/**
 * GH Pay — real Pi commerce surface (not a checklist test card).
 *
 * - Payment intents bind Pi approve/complete to purpose + user + order
 * - Pi (π) and GHC stay separate — no conversion rate
 * - Verification is a small status chip, not the product
 */

import { useCallback, useEffect, useState } from "react"
import {
  ShieldCheck,
  ShieldAlert,
  Crown,
  Zap,
  ShoppingBag,
  ExternalLink,
  Loader2,
  CheckCircle2,
} from "lucide-react"
import {
  isPiPaymentsAvailable,
  ghPayPurchase,
  ghPayMembership,
  ghPayListMyOrders,
} from "@/lib/gh-pay"
import type { GhPayOrder } from "@/lib/gh-pay/types"
import { getProduct } from "@/lib/gh-pay/catalog"
import { ASSET_POLICY } from "@/lib/asset-separation"

const VERIFY_KEY = "gh_pay_pi_verified_v1"

function readVerified(): boolean {
  try {
    return localStorage.getItem(VERIFY_KEY) === "1"
  } catch {
    return false
  }
}

function writeVerified() {
  try {
    localStorage.setItem(VERIFY_KEY, "1")
  } catch {
    /* */
  }
}

type ToastFn = (msg: string, type?: string) => void

function statusLabel(status: GhPayOrder["status"]): string {
  switch (status) {
    case "created":
    case "awaiting_approval":
      return "Pending approval"
    case "awaiting_user":
      return "Waiting for you in Pi"
    case "awaiting_completion":
      return "Completing…"
    case "completed":
    case "fulfilled":
      return "Completed"
    case "failed":
      return "Failed"
    case "cancelled":
      return "Cancelled"
    case "refunded":
      return "Refunded"
    default:
      return status
  }
}

export function GhPayPanel({
  compact,
  onToast,
}: {
  compact?: boolean
  onToast?: ToastFn
}) {
  const [verified, setVerified] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<GhPayOrder[]>([])
  const inPi = typeof window !== "undefined" && isPiPaymentsAvailable()

  const refreshOrders = useCallback(() => {
    try {
      setOrders(ghPayListMyOrders().slice(0, 5))
    } catch {
      setOrders([])
    }
  }, [])

  useEffect(() => {
    setVerified(readVerified())
    refreshOrders()
  }, [refreshOrders])

  const notify = useCallback(
    (msg: string, type: "success" | "error" | "info" = "info") => {
      onToast?.(msg, type)
    },
    [onToast]
  )

  const runProduct = useCallback(
    async (productId: string, label: string) => {
      setError(null)
      if (!isPiPaymentsAvailable()) {
        const msg =
          "Open GreenHaven in the Pi Browser to pay with π. GHC stays in your wallet — separate from Pi."
        setError(msg)
        notify(msg, "error")
        return
      }
      setBusy(productId)
      try {
        notify(`Starting ${label}…`, "info")
        const result = await ghPayPurchase(productId)
        if (result.ok) {
          if (productId === "pipeline_verification") writeVerified()
          setVerified(readVerified() || productId === "pipeline_verification")
          notify(`${label} completed`, "success")
          refreshOrders()
          return
        }
        if (result.cancelled) {
          notify("Payment cancelled", "info")
          return
        }
        const msg = result.error || "Payment failed"
        setError(msg)
        notify(msg, "error")
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Payment failed"
        setError(msg)
        notify(msg, "error")
      } finally {
        setBusy(null)
      }
    },
    [notify, refreshOrders]
  )

  const products = [
    {
      id: "membership_vip_monthly",
      icon: Crown,
      title: "VIP · Monthly",
      amount: getProduct("membership_vip_monthly")?.amountPi ?? 1,
      blurb: "Priority discovery & elevated limits",
    },
    {
      id: "membership_vvip_monthly",
      icon: Crown,
      title: "VVIP · Monthly",
      amount: getProduct("membership_vvip_monthly")?.amountPi ?? 3,
      blurb: "Maximum visibility & support",
    },
    {
      id: "profile_boost",
      icon: Zap,
      title: "Profile boost",
      amount: getProduct("profile_boost")?.amountPi ?? 0.5,
      blurb: "24h extra exposure on Discover",
    },
  ]

  return (
    <section
      className={
        compact
          ? "rounded-2xl border border-border/80 bg-card p-3.5"
          : "rounded-2xl border border-border bg-card p-4 shadow-sm"
      }
      aria-label="GH Pay commerce"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
            GH Pay
          </p>
          <h2 className="mt-0.5 text-[15px] font-black tracking-tight text-foreground">
            Pay with π
          </h2>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            {ASSET_POLICY.piRailsCopy} {ASSET_POLICY.piPeerCopy} GHC stays on the GreenHaven
            ledger — never mixed or converted here.
          </p>
        </div>
        <div
          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${
            verified
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          }`}
        >
          {verified ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
          {verified ? "Ready" : "Setup"}
        </div>
      </div>

      {!inPi ? (
        <p className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Pi payments only work inside the Pi Browser on your live app URL.
        </p>
      ) : null}

      {/* Commerce products */}
      <ul className="mt-3 space-y-2">
        {products.map((p) => {
          const Icon = p.icon
          const isBusy = busy === p.id
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void runProduct(p.id, p.title)}
                className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 text-left transition hover:bg-muted/40 disabled:opacity-60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-300">
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-foreground">{p.title}</span>
                  <span className="block text-[11px] text-muted-foreground">{p.blurb}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[13px] font-black tabular-nums text-foreground">
                    {p.amount} π
                  </span>
                  <span className="block text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {isBusy ? (
                      <span className="inline-flex items-center gap-0.5">
                        <Loader2 size={10} className="animate-spin" /> Paying
                      </span>
                    ) : (
                      "Buy"
                    )}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-border/80 px-3 py-2">
        <ShoppingBag size={14} className="shrink-0 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground">
          Marketplace checkout uses the same GH Pay intents when you pay a listing with π.
        </p>
      </div>

      {/* Optional pipeline check — secondary */}
      {!verified ? (
        <div className="mt-3 rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-foreground">First-time Pi setup</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Optional 0.01 π check confirms the payment pipeline. It does not change GHC.
          </p>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void runProduct("pipeline_verification", "Pipeline check")}
            className="mt-2 inline-flex min-h-9 w-full items-center justify-center rounded-full border border-border bg-background text-[12px] font-bold text-foreground disabled:opacity-60"
          >
            {busy === "pipeline_verification" ? "Waiting for Pi…" : "Run 0.01 π check"}
          </button>
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={14} />
          Pi payment pipeline verified on this device
        </p>
      )}

      {error ? (
        <p className="mt-2 text-[11px] font-medium text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      {/* Recent GH Pay orders */}
      {orders.length > 0 ? (
        <div className="mt-3 border-t border-border/50 pt-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Recent Pi orders
          </p>
          <ul className="mt-1.5 space-y-1">
            {orders.map((o) => (
              <li
                key={o.orderId}
                className="flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="truncate font-medium text-foreground">
                  {o.memo || o.productId}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {o.amountPi} π · {statusLabel(o.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 flex items-start gap-1 text-[10px] leading-snug text-muted-foreground">
        <ExternalLink size={10} className="mt-0.5 shrink-0" />
        Server payment intents bind each Pi payment to your account, purpose, and order before
        approve/complete.
      </p>
    </section>
  )
}

/**
 * Membership purchase via GH Pay (Pi U2A).
 * Keeps Pi and GHC separate — only completes Pi payment for the membership product.
 */
export async function runGhPayMembership(
  tier: "vip" | "vvip",
  period: "monthly" | "yearly" = "monthly",
  onToast?: ToastFn
): Promise<boolean> {
  try {
    if (!isPiPaymentsAvailable()) {
      onToast?.(
        "Open GreenHaven inside the Pi Browser to pay for membership with π",
        "error"
      )
      return false
    }
    onToast?.(`Starting ${tier.toUpperCase()} membership payment…`, "info")
    const result = await ghPayMembership(tier, period)
    if (result.ok) {
      onToast?.(`${tier.toUpperCase()} membership payment completed`, "success")
      return true
    }
    if (result.cancelled) {
      onToast?.("Membership payment cancelled", "info")
      return false
    }
    onToast?.(result.error || "Membership payment failed", "error")
    return false
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Membership payment failed"
    onToast?.(msg, "error")
    return false
  }
}

/** Profile / post boost paid in π via GH Pay */
export async function runGhPayBoost(
  target: "profile" | "post" = "profile",
  onToast?: ToastFn
): Promise<boolean> {
  try {
    if (!isPiPaymentsAvailable()) {
      onToast?.("Open GreenHaven in the Pi Browser to boost with π", "error")
      return false
    }
    const productId = target === "post" ? "post_boost" : "profile_boost"
    onToast?.("Starting boost payment…", "info")
    const result = await ghPayPurchase(productId)
    if (result.ok) {
      onToast?.("Boost payment completed", "success")
      return true
    }
    if (result.cancelled) {
      onToast?.("Boost cancelled", "info")
      return false
    }
    onToast?.(result.error || "Boost payment failed", "error")
    return false
  } catch (e) {
    onToast?.(e instanceof Error ? e.message : "Boost failed", "error")
    return false
  }
}

export default GhPayPanel
