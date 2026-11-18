/**
 * Client helper — start governed Pi → GHC pack acquisition.
 * Creates durable intent; caller completes Pi payment via GH Pay / Pi SDK.
 */

export type PackIntentResult =
  | {
      ok: true
      intentId: string
      amountPi: number
      productId: string
      ghcAmount: number
      label: string
    }
  | { ok: false; error: string; message?: string }

export async function createGhcPackIntent(productId: string): Promise<PackIntentResult> {
  const id = String(productId || "").trim()
  if (!id) return { ok: false, error: "INVALID_PACK" }
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    try {
      const { IdentityService } = await import("@/lib/identity/identity-service")
      Object.assign(headers, IdentityService.getAuthHeaders?.() || {})
    } catch {
      /* */
    }
    const res = await fetch("/api/economy/packs/intent", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({
        productId: id,
        idempotencyKey: `pack-${id}-${Date.now()}`,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: String(data.error || "INTENT_FAILED"),
        message: data.message ? String(data.message) : undefined,
      }
    }
    return {
      ok: true,
      intentId: String(data.intentId),
      amountPi: Number(data.amountPi),
      productId: String(data.productId),
      ghcAmount: Number(data.ghcAmount),
      label: String(data.label || ""),
    }
  } catch {
    return { ok: false, error: "NETWORK" }
  }
}

/** After Pi payment completes, credit GHC (idempotent). */
export async function completeGhcPackPurchase(input: {
  intentId: string
  productId: string
  paymentId?: string
}): Promise<{ ok: boolean; granted?: boolean; error?: string; ghcAmount?: number }> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    try {
      const { IdentityService } = await import("@/lib/identity/identity-service")
      Object.assign(headers, IdentityService.getAuthHeaders?.() || {})
    } catch {
      /* */
    }
    const res = await fetch("/api/economy/purchase-ghc", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(input),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok || !data.ok) {
      return { ok: false, error: String(data.error || "CREDIT_FAILED") }
    }
    return {
      ok: true,
      granted: Boolean(data.granted),
      ghcAmount: data.ghcAmount != null ? Number(data.ghcAmount) : undefined,
    }
  } catch {
    return { ok: false, error: "NETWORK" }
  }
}
