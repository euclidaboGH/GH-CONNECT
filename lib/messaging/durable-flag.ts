/**
 * Client-safe feature flag for durable messaging.
 * When enabled, send/list prefer server APIs; permanent success only after API ok.
 *
 * Enabled when:
 * - NEXT_PUBLIC_MESSAGING_DURABLE is truthy, OR
 * - runtime opt-in window.__GHC_MESSAGING_DURABLE === true
 *
 * Server always uses durable store when Supabase is configured regardless of this flag.
 * Client still attempts durable write when online (see messaging-domain) and treats
 * API failure as soft (local optimistic retained) unless the flag is on.
 */
export function isDurableMessagingEnabled(): boolean {
  try {
    const v = (process.env.NEXT_PUBLIC_MESSAGING_DURABLE || "").trim().toLowerCase()
    if (v === "1" || v === "true" || v === "yes") return true
    if (typeof window !== "undefined") {
      const w = window as unknown as { __GHC_MESSAGING_DURABLE?: boolean }
      if (w.__GHC_MESSAGING_DURABLE === true) return true
    }
  } catch {
    /* */
  }
  return false
}

/** Prefer durable path whenever the user is online (hybrid). */
export function shouldAttemptDurableMessaging(offline?: boolean): boolean {
  if (offline) return false
  if (typeof window === "undefined") return false
  return true
}
