/**
 * Unified section refresh coordination.
 * Prevents N-per-card listeners, stampeding focus/visibility reloads, and silent stalls.
 */

export type SectionRefreshId =
  | "feed"
  | "marketplace"
  | "marketplace-orders"
  | "communities"
  | "messages"
  | "discover"
  | "wallet"
  | "rewards"
  | "earnings"
  | "notifications"
  | "profile"

/** Canonical CustomEvent names for section refresh. */
export const SECTION_REFRESH_EVENT: Record<SectionRefreshId, string> = {
  feed: "ghc:feed-refresh",
  marketplace: "ghc:marketplace-refresh",
  "marketplace-orders": "ghc:marketplace-order-changed",
  communities: "ghc:communities-refresh",
  messages: "ghc:messages-refresh",
  discover: "ghc:discover-refresh",
  wallet: "ghc:wallet-refresh",
  rewards: "ghc:wallet-refresh",
  earnings: "ghc:earnings-refresh",
  notifications: "ghc:notifications-refresh",
  profile: "ghc:profile-refresh",
}

const lastEmitAt = new Map<string, number>()

export function emitSectionRefresh(
  section: SectionRefreshId,
  detail?: { reason?: string; [key: string]: unknown },
  opts?: { minIntervalMs?: number },
): boolean {
  if (typeof window === "undefined") return false
  const min = opts?.minIntervalMs ?? 400
  const key = section
  const now = Date.now()
  const prev = lastEmitAt.get(key) || 0
  if (now - prev < min) return false
  lastEmitAt.set(key, now)
  try {
    window.dispatchEvent(
      new CustomEvent(SECTION_REFRESH_EVENT[section], {
        detail: { reason: detail?.reason || "emit", at: now, ...detail },
      }),
    )
    return true
  } catch {
    return false
  }
}

export type SoftRefreshOptions = {
  /** Minimum gap between soft refreshes (focus/visibility). Default 12s. */
  minIntervalMs?: number
  /** Run on window focus. Default true. */
  onFocus?: boolean
  /** Run when tab becomes visible. Default true. */
  onVisible?: boolean
  /** Run when browser comes online. Default true. */
  onOnline?: boolean
  /** Extra event names to listen for (in addition to section event). */
  events?: string[]
}

/**
 * Attach soft-refresh listeners. Returns cleanup.
 * Call from useEffect; do not register per list row.
 */
export function attachSoftRefresh(
  handler: (reason: string) => void | Promise<void>,
  opts: SoftRefreshOptions & { section?: SectionRefreshId } = {},
): () => void {
  if (typeof window === "undefined") return () => {}
  const min = opts.minIntervalMs ?? 12_000
  let last = 0
  let inflight = false
  let queued: string | null = null

  const run = (reason: string) => {
    const now = Date.now()
    if (now - last < min && reason !== "manual" && reason !== "event-forced") {
      return
    }
    if (inflight) {
      queued = reason
      return
    }
    last = now
    inflight = true
    let result: void | Promise<void>
    try {
      result = handler(reason)
    } catch {
      inflight = false
      return
    }
    Promise.resolve(result).finally(() => {
      inflight = false
      if (queued) {
        const q = queued
        queued = null
        run(q === "manual" ? "manual" : "event-forced")
      }
    })
  }

  const onFocus = () => {
    if (opts.onFocus === false) return
    run("focus")
  }
  const onVis = () => {
    if (opts.onVisible === false) return
    if (document.visibilityState === "visible") run("visible")
  }
  const onOnline = () => {
    if (opts.onOnline === false) return
    run("online")
  }

  if (opts.onFocus !== false) window.addEventListener("focus", onFocus)
  if (opts.onVisible !== false) document.addEventListener("visibilitychange", onVis)
  if (opts.onOnline !== false) window.addEventListener("online", onOnline)

  const eventNames = [
    ...(opts.section ? [SECTION_REFRESH_EVENT[opts.section]] : []),
    ...(opts.events || []),
  ]
  const onEvent = () => run("event-forced")
  for (const name of eventNames) {
    window.addEventListener(name, onEvent)
  }

  return () => {
    window.removeEventListener("focus", onFocus)
    document.removeEventListener("visibilitychange", onVis)
    window.removeEventListener("online", onOnline)
    for (const name of eventNames) {
      window.removeEventListener(name, onEvent)
    }
  }
}

/** Async-aware soft refresh: coalesces concurrent runs. */
export function createAsyncRefreshGate(
  load: (reason: string) => Promise<void>,
  minIntervalMs = 8_000,
) {
  let last = 0
  let inflight: Promise<void> | null = null

  return async (reason: string) => {
    const forced = reason === "manual" || reason === "event-forced"
    const now = Date.now()
    if (!forced && now - last < minIntervalMs) return
    if (inflight) return inflight
    last = now
    inflight = (async () => {
      try {
        await load(reason)
      } finally {
        inflight = null
      }
    })()
    return inflight
  }
}
