"use client"

/**
 * Get GHC — Rewards · Receive · Governed Pi packs (not free FX).
 */
import { useEffect, useState } from "react"
import { X, Gift, ArrowDownLeft, Lock, Coins, Loader2 } from "lucide-react"
import { GhcCoinIcon } from "@/components/ghc/ghc-coin-icon"
import { ASSET_POLICY } from "@/lib/asset-separation"
import { createGhcPackIntent } from "@/lib/economy/buy-ghc-pack"

export const GHC_BUY_WITH_PI_ENABLED =
  typeof process !== "undefined" &&
  (process.env.NEXT_PUBLIC_GHC_BUY_WITH_PI === "true" ||
    process.env.NEXT_PUBLIC_GHC_BUY_WITH_PI_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_GHC_TESTNET_UNLOCK === "true" ||
    process.env.NEXT_PUBLIC_GHC_TESTNET_UNLOCK === "1")

type Pack = {
  productId: string
  ghcAmount: number
  piAmount: number
  label?: string
}

export function AddGhcSheet({
  open,
  onClose,
  onEarn,
  onReceive,
  onBuy,
  onSelectPack,
}: {
  open: boolean
  onClose: () => void
  onEarn: () => void
  onReceive: () => void
  onBuy?: () => void
  /** Optional: parent opens GH Pay with selected pack productId */
  onSelectPack?: (pack: Pack) => void
}) {
  const [packs, setPacks] = useState<Pack[]>([])
  const [packsLoading, setPacksLoading] = useState(false)
  const [packsEnabled, setPacksEnabled] = useState(GHC_BUY_WITH_PI_ENABLED)

  useEffect(() => {
    if (!open || !GHC_BUY_WITH_PI_ENABLED) return
    let cancelled = false
    setPacksLoading(true)
    ;(async () => {
      try {
        const res = await fetch("/api/economy/purchase-ghc", { credentials: "include" })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          enabled?: boolean
          packs?: Pack[]
        }
        if (cancelled) return
        setPacksEnabled(Boolean(data.enabled ?? GHC_BUY_WITH_PI_ENABLED))
        if (Array.isArray(data.packs)) setPacks(data.packs)
      } catch {
        if (!cancelled) setPacks([])
      } finally {
        if (!cancelled) setPacksLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="Close" onClick={onClose} />
      <div className="gh-sheet-panel relative z-[81] max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[1.5rem] border border-border/60 bg-card p-4 shadow-2xl sm:rounded-[1.5rem]">
        <div className="mb-3 flex items-center gap-2">
          <GhcCoinIcon size={28} />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-foreground">Get GHC</h2>
            <p className="text-[11px] text-muted-foreground">
              Earn, receive, or buy a fixed utility pack with π
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-muted" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <ul className="space-y-2">
          <li>
            <button
              type="button"
              onClick={() => {
                onEarn()
                onClose()
              }}
              className="gh-list-row flex w-full items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-3 text-left transition hover:bg-muted/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/12 text-emerald-700">
                <Gift size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold">Rewards</span>
                <span className="block text-[11px] text-muted-foreground">
                  Daily claim, missions, and activity credits after validation
                </span>
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                onReceive()
                onClose()
              }}
              className="gh-list-row flex w-full items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-3 text-left transition hover:bg-muted/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600/12 text-sky-700">
                <ArrowDownLeft size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold">Receive GHC</span>
                <span className="block text-[11px] text-muted-foreground">
                  Share your GH ID so another member can send you GHC
                </span>
              </span>
            </button>
          </li>
        </ul>

        <div className="mt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Buy with π · fixed packs
          </p>
          {!GHC_BUY_WITH_PI_ENABLED || !packsEnabled ? (
            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-3">
              <Lock size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-[12px] text-muted-foreground">
                Pi-funded packs are not enabled on this deployment. Set testnet unlock or buy flags when ready.
              </p>
            </div>
          ) : packsLoading ? (
            <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> Loading packs…
            </p>
          ) : packs.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No packs in server catalog yet.</p>
          ) : (
            <ul className="space-y-2">
              {packs.map((pack) => (
                <li key={pack.productId}>
                  <button
                    type="button"
                    onClick={async () => {
                      onSelectPack?.(pack)
                      try {
                        const intent = await createGhcPackIntent(pack.productId)
                        if (!intent.ok) {
                          try {
                            window.dispatchEvent(
                              new CustomEvent("ghc:toast", {
                                detail: {
                                  message: intent.message || intent.error || "Could not start pack purchase",
                                  type: "error",
                                },
                              }),
                            )
                          } catch { /* */ }
                          return
                        }
                        try {
                          window.dispatchEvent(
                            new CustomEvent("ghc:toast", {
                              detail: {
                                message: `Intent ready · pay ${intent.amountPi} π for ${intent.label}`,
                                type: "info",
                              },
                            }),
                          )
                        } catch { /* */ }
                        try {
                          window.dispatchEvent(
                            new CustomEvent("ghc:ghc-pack-intent", {
                              detail: intent,
                            }),
                          )
                        } catch { /* */ }
                      } catch { /* */ }
                      onBuy?.()
                      onClose()
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-violet-200/80 bg-violet-50/40 px-3 py-3 text-left transition hover:bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/12 text-violet-700 dark:text-violet-300">
                      <Coins size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-foreground">
                        {pack.label || `${pack.ghcAmount} GHC`}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        Pay {pack.piAmount} π · server credits {pack.ghcAmount} GHC after verification
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] font-bold text-violet-700 dark:text-violet-300">
                      {pack.piAmount} π
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
          {ASSET_POLICY.packPurchaseCopy} {ASSET_POLICY.walletCopy}
        </p>
      </div>
    </div>
  )
}
