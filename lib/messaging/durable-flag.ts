/**
 * Client-safe feature flag for durable messaging.
 * When enabled, send/list prefer server APIs; permanent success only after API ok.
 * Default off so existing local behavior remains until ops enables it.
 */
export function isDurableMessagingEnabled(): boolean {
  try {
    const v = (process.env.NEXT_PUBLIC_MESSAGING_DURABLE || "").trim().toLowerCase()
    return v === "1" || v === "true" || v === "yes"
  } catch {
    return false
  }
}
