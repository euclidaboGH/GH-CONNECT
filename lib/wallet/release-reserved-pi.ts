/**
 * Client helper: ask server to return incomplete reserved π to Available.
 * Server is authoritative; never invents a local balance change.
 */

export type ReleaseReservedItem = {
  requestId: string
  status: string
  grossAtomic?: number | string
  reason?: string
  reasonCode?: string
  unlockCondition?: string
}

export type ReleaseReservedResult =
  | {
      ok: true
      released: number
      releasedAtomic: number
      items: ReleaseReservedItem[]
      message: string | null
      httpStatus: number
    }
  | {
      ok: false
      error: string
      message: string
      httpStatus: number
      items?: ReleaseReservedItem[]
    }

export function humanizeReleaseReservedError(code: string | null | undefined): string {
  const c = String(code || "").toUpperCase()
  switch (c) {
    case "AUTH_REQUIRED":
      return "Sign in with Pi again, then retry returning reserved π to available."
    case "RATE_LIMITED":
    case "DURABLE_RATE_LIMIT":
      return "Too many release attempts. Wait a minute and try again."
    case "PAYOUT_RECOVERY_MIGRATION_PENDING":
      return "Server recovery tools are not fully applied yet. Your reserved π is unchanged and safe. Ask the operator to apply the Phase 3 payout recovery migration, then retry."
    case "EARNINGS_LEDGER_UNAVAILABLE":
      return "Earnings ledger is temporarily unavailable. Reserved π is unchanged. Retry shortly."
    case "RESERVATION_RELEASE_REJECTED":
      return "The server refused one release step for safety. Reserved π is unchanged. Use Reconcile on uncertain requests or contact support with the request id."
    case "CANCEL_FAILED":
      return "Could not complete the release check. Reserved π is unchanged."
    default:
      return "Could not return reserved π right now. Your funds are still held on the server and were not removed."
  }
}

export async function releaseReservedPi(signal?: AbortSignal): Promise<ReleaseReservedResult> {
  const res = await fetch("/api/economy/earnings/withdrawals/cancel", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  })
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean
    error?: string
    released?: number
    releasedAtomic?: number
    message?: string
    items?: ReleaseReservedItem[]
  } | null

  if (res.ok && body?.ok) {
    return {
      ok: true,
      released: Number(body.released || 0),
      releasedAtomic: Number(body.releasedAtomic || 0),
      items: Array.isArray(body.items) ? body.items : [],
      message: typeof body.message === "string" ? body.message : null,
      httpStatus: res.status,
    }
  }

  const error = String(body?.error || (res.status === 401 ? "AUTH_REQUIRED" : "CANCEL_FAILED"))
  return {
    ok: false,
    error,
    message: humanizeReleaseReservedError(error),
    httpStatus: res.status,
    items: Array.isArray(body?.items) ? body!.items : undefined,
  }
}

/** Notify wallet/earnings surfaces after a release attempt. */
export function emitWalletBalanceRefresh(): void {
  if (typeof window === "undefined") return
  try {
    window.dispatchEvent(new CustomEvent("ghc:wallet-refresh"))
    window.dispatchEvent(new CustomEvent("ghc:earnings-refresh"))
    window.dispatchEvent(new CustomEvent("ghc:wallet-synced"))
  } catch { /* */ }
}
