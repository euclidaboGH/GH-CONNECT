"use client"

/**
 * Get GHC — clear paths only:
 * Earn (rewards) · Receive (P2P) · Buy with Pi (server-only when enabled)
 * Never implies client-side Pi→GHC conversion.
 */
import { X, Gift, ArrowDownLeft, Lock, Coins } from "lucide-react"
import { GhcCoinIcon } from "@/components/ghc/ghc-coin-icon"
import { ASSET_POLICY } from "@/lib/asset-separation"

/** Server flag — enable only when /api/economy/purchase-ghc is production-ready */
export const GHC_BUY_WITH_PI_ENABLED =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_GHC_BUY_WITH_PI === "true"

export function AddGhcSheet({
  open,
  onClose,
  onEarn,
  onReceive,
  onBuy,
}: {
  open: boolean
  onClose: () => void
  onEarn: () => void
  onReceive: () => void
  onBuy?: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="Close" onClick={onClose} />
      <div className="relative z-[81] w-full max-w-md rounded-t-3xl border border-border bg-card p-4 shadow-2xl sm:rounded-3xl">
        <div className="mb-3 flex items-center gap-2">
          <GhcCoinIcon size={28} />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-foreground">Get GHC</h2>
            <p className="text-[11px] text-muted-foreground">
              Choose how you want GreenHaven Coin · {ASSET_POLICY.walletCopy}
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
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-3 py-3 text-left transition hover:bg-muted/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/12 text-emerald-700">
                <Gift size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold">Earn GHC</span>
                <span className="block text-[11px] text-muted-foreground">
                  Daily rewards, missions, activity — credited by the ledger after validation
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
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-3 py-3 text-left transition hover:bg-muted/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600/12 text-sky-700">
                <ArrowDownLeft size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold">Receive GHC</span>
                <span className="block text-[11px] text-muted-foreground">
                  Share your GH ID or QR so another member can send you GHC
                </span>
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              disabled={!GHC_BUY_WITH_PI_ENABLED}
              onClick={() => {
                if (!GHC_BUY_WITH_PI_ENABLED) return
                onBuy?.()
                onClose()
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-3 py-3 text-left transition hover:bg-muted/40 disabled:opacity-70"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/12 text-violet-700">
                {GHC_BUY_WITH_PI_ENABLED ? <Coins size={18} /> : <Lock size={18} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold">
                  Buy GHC with Pi{GHC_BUY_WITH_PI_ENABLED ? "" : " · Coming soon"}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {GHC_BUY_WITH_PI_ENABLED
                    ? "Pay with π via GH Pay. Server verifies payment, then credits GHC. Pi and GHC stay separate."
                    : "Pi purchase will credit GHC only after server-side payment verification. Not enabled yet."}
                </span>
              </span>
            </button>
          </li>
        </ul>

        <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
          GHC is not Pi. There is no automatic conversion rate. Buy (when available) is a verified purchase
          that authorizes a separate GHC ledger credit — not a swap inside your wallet.
        </p>
      </div>
    </div>
  )
}
