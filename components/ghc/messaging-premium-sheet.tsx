"use client"

/**
 * Optional messaging utilities — never required to send a normal message.
 */
import { useState } from "react"
import { X, Sparkles, Loader2 } from "lucide-react"
import {
  listMessagingPremiumProducts,
  MESSAGING_FREE_GUARANTEE,
  type MessagingPremiumProductId,
} from "@/lib/domains/messaging-premium"
import { IdentityService } from "@/lib/identity/identity-service"
import { GhcCoinIcon } from "./ghc-coin-icon"

export function MessagingPremiumSheet({
  open,
  onClose,
  onToast,
}: {
  open: boolean
  onClose: () => void
  onToast?: (msg: string, type: "success" | "error" | "info") => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  if (!open) return null

  const products = listMessagingPremiumProducts()

  const buy = async (productId: MessagingPremiumProductId) => {
    if (busy) return
    setBusy(productId)
    try {
      const res = await fetch("/api/messaging/premium", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...IdentityService.getAuthHeaders(),
        },
        body: JSON.stringify({ productId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        onToast?.(data?.error || data?.message || "Purchase failed", "error")
        return
      }
      onToast?.(`${data.productId} unlocked`, "success")
      onClose()
    } catch (e) {
      onToast?.(e instanceof Error ? e.message : "Purchase failed", "error")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="Close" onClick={onClose} />
      <div className="relative z-[81] max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-4 shadow-2xl sm:rounded-3xl">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="text-emerald-600" size={18} />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-foreground">Message tools</h2>
            <p className="text-[11px] text-muted-foreground">{MESSAGING_FREE_GUARANTEE}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-muted" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <ul className="space-y-2">
          {products.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void buy(p.id)}
                className="flex w-full items-start gap-3 rounded-2xl border border-border bg-background px-3 py-3 text-left transition hover:bg-muted/40 disabled:opacity-60"
              >
                <GhcCoinIcon size={22} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-foreground">{p.title}</span>
                  <span className="block text-[11px] text-muted-foreground">{p.description}</span>
                </span>
                <span className="shrink-0 text-[12px] font-bold tabular-nums text-emerald-700">
                  {busy === p.id ? <Loader2 size={14} className="animate-spin" /> : `${p.priceGhc} GHC`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
