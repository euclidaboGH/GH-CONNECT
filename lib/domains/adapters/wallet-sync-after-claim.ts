/**
 * After authoritative POST /api/economy/rewards/daily succeeds, re-hydrate
 * the client economy repository from the server ledger. Never invent balances.
 */

import { domainEvents } from "@/lib/realtime/event-bus"
import { getBoundDomainServices } from "@/lib/domains/compat"
import { IdentityService } from "@/lib/identity/identity-service"

export type WalletSyncResult = {
  ok: boolean
  /** Server snapshot available after hydrate */
  balance?: number
  error?: string
}

function parseBalance(payload: unknown): number | undefined {
  if (!payload || typeof payload !== "object") return undefined
  const o = payload as Record<string, unknown>
  const candidates = [
    o.balance,
    o.available,
    o.availableBalance,
    (o.wallet as Record<string, unknown> | undefined)?.balance,
    (o.wallet as Record<string, unknown> | undefined)?.available,
    (o.data as Record<string, unknown> | undefined)?.balance,
  ]
  for (const c of candidates) {
    const n = Number(c)
    if (Number.isFinite(n) && n >= 0) return n
  }
  return undefined
}

/**
 * Fetch durable wallet ledger into the bound economy repo and notify UI.
 * On failure: leave last known repo state; do not optimistically credit.
 */
export async function syncWalletAfterServerClaim(input?: {
  userId?: string | null
  /** Pass-through for event consumers (not used as balance) */
  claimedAmount?: number | null
  referenceId?: string | null
  alreadyClaimed?: boolean
}): Promise<WalletSyncResult> {
  const userId =
    (input?.userId && String(input.userId).trim()) ||
    IdentityService.getCurrentUserId?.() ||
    ""
  if (!userId) {
    return { ok: false, error: "NO_USER" }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(IdentityService.getAuthHeaders?.() || {}),
  }

  let balance: number | undefined

  try {
    const eco = getBoundDomainServices()?.economy as {
      hydrate?: (userId: string) => Promise<void>
      getWallet?: () => { balance?: number; available?: number }
    } | null

    if (typeof eco?.hydrate === "function") {
      try {
        await eco.hydrate(userId)
      } catch {
        /* continue to HTTP fallback */
      }
    }

    // Always try durable HTTP snapshot so Wallet UI can refresh across instances
    try {
      const res = await fetch(`/api/economy/wallet/${encodeURIComponent(userId)}`, {
        method: "GET",
        headers,
        credentials: "include",
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        balance = parseBalance(data)
      } else if (!eco?.hydrate) {
        return { ok: false, error: `HYDRATE_HTTP_${res.status}` }
      }
    } catch {
      if (balance == null && !eco?.getWallet) {
        return { ok: false, error: "HYDRATE_NETWORK" }
      }
    }

    if (balance == null) {
      try {
        const w = eco?.getWallet?.()
        const n = Number(w?.balance ?? w?.available)
        if (Number.isFinite(n)) balance = n
      } catch {
        /* */
      }
    }

    try {
      domainEvents.emit("WALLET_BALANCE_UPDATED", {
        userId,
        balance,
        source: "daily_claim_hydrate",
        claimedAmount: input?.claimedAmount ?? null,
        referenceId: input?.referenceId ?? null,
        alreadyClaimed: Boolean(input?.alreadyClaimed),
        at: Date.now(),
      })
    } catch {
      /* */
    }

    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ghc:wallet-synced", {
            detail: {
              userId,
              balance,
              source: "daily_claim",
              claimedAmount: input?.claimedAmount ?? null,
              alreadyClaimed: Boolean(input?.alreadyClaimed),
            },
          })
        )
        window.dispatchEvent(
          new CustomEvent("ghc:daily-reward-claimed", {
            detail: {
              userId,
              balance,
              server: true,
              claimedAmount: input?.claimedAmount ?? null,
              alreadyClaimed: Boolean(input?.alreadyClaimed),
            },
          })
        )
      }
    } catch {
      /* */
    }

    return { ok: true, balance }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "HYDRATE_FAILED",
    }
  }
}
