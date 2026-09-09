/**
 * Pi Browser local storage adapter (Sep 2026 capability) with safe fallbacks.
 *
 * Official constraints (minepi.com blog):
 * - Initially whitelist-only
 * - Device + account scoped (not cross-device)
 * - Shared quota; stale data may be evicted
 * - NOT guaranteed permanent storage
 * - Data stays on device (not uploaded to Pi servers)
 *
 * SECURITY RULES FOR GH CONNECT:
 * - NEVER store: session tokens, Pi access tokens, PIN plaintext, private keys,
 *   GHC balances, payment secrets, or onboarding authority flags as sole source of truth.
 * - OK to store: theme, UI prefs, tip-dismiss flags, draft text, last tab, coach marks.
 *
 * When Pi local storage API is unavailable, falls back to window.localStorage
 * under a namespaced key prefix.
 */

const NS = "gh_pi_ls_v1:"

export type PiLocalStorageBackend = "pi" | "web-local" | "memory" | "unavailable"

type MemoryBag = Map<string, string>
const memoryStore: MemoryBag = new Map()

function getPiStorageApi(): {
  getItem?: (key: string) => Promise<string | null> | string | null
  setItem?: (key: string, value: string) => Promise<void> | void
  removeItem?: (key: string) => Promise<void> | void
} | null {
  if (typeof window === "undefined") return null
  const Pi = (window as unknown as { Pi?: Record<string, unknown> }).Pi
  if (!Pi) return null
  // Possible shapes as docs evolve — probe without assuming final names
  const candidates = [
    Pi.localStorage,
    Pi.storage,
    (Pi as { appStorage?: unknown }).appStorage,
  ]
  for (const c of candidates) {
    if (c && typeof c === "object") {
      const api = c as {
        getItem?: (key: string) => Promise<string | null> | string | null
        setItem?: (key: string, value: string) => Promise<void> | void
        removeItem?: (key: string) => Promise<void> | void
      }
      if (typeof api.getItem === "function" && typeof api.setItem === "function") {
        return api
      }
    }
  }
  // Functional style: Pi.getLocalItem / setLocalItem
  if (
    typeof Pi.getLocalItem === "function" &&
    typeof Pi.setLocalItem === "function"
  ) {
    return {
      getItem: (k) => (Pi.getLocalItem as (key: string) => Promise<string | null> | string | null)(k),
      setItem: (k, v) => (Pi.setLocalItem as (key: string, value: string) => Promise<void> | void)(k, v),
      removeItem:
        typeof Pi.removeLocalItem === "function"
          ? (k) => (Pi.removeLocalItem as (key: string) => Promise<void> | void)(k)
          : undefined,
    }
  }
  return null
}

export function resolvePiLocalStorageBackend(): PiLocalStorageBackend {
  if (typeof window === "undefined") return "unavailable"
  if (getPiStorageApi()) return "pi"
  try {
    const k = `${NS}__probe__`
    window.localStorage.setItem(k, "1")
    window.localStorage.removeItem(k)
    return "web-local"
  } catch {
    return "memory"
  }
}

function webKey(key: string): string {
  return `${NS}${key}`
}

/** Keys that must never be written through this helper (defense in depth). */
const FORBIDDEN_KEY_PARTS = [
  "access_token",
  "accesstoken",
  "pi_token",
  "session_token",
  "gh_session",
  "pin_hash",
  "pin_plain",
  "private_key",
  "mnemonic",
  "seed",
  "password",
  "secret",
]

function assertSafeKey(key: string): void {
  const k = key.toLowerCase()
  for (const bad of FORBIDDEN_KEY_PARTS) {
    if (k.includes(bad)) {
      throw new Error(`pi-local-storage: refused unsafe key (${key})`)
    }
  }
}

export async function piLocalGet(key: string): Promise<string | null> {
  assertSafeKey(key)
  const api = getPiStorageApi()
  if (api?.getItem) {
    try {
      const v = await Promise.resolve(api.getItem(key))
      return v == null ? null : String(v)
    } catch (e) {
      console.warn("[pi-local-storage] pi get failed", e)
    }
  }
  if (typeof window !== "undefined") {
    try {
      return window.localStorage.getItem(webKey(key))
    } catch {
      /* */
    }
  }
  return memoryStore.has(key) ? memoryStore.get(key)! : null
}

export async function piLocalSet(key: string, value: string): Promise<boolean> {
  assertSafeKey(key)
  const str = String(value)
  const api = getPiStorageApi()
  if (api?.setItem) {
    try {
      await Promise.resolve(api.setItem(key, str))
      return true
    } catch (e) {
      console.warn("[pi-local-storage] pi set failed", e)
    }
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(webKey(key), str)
      return true
    } catch {
      /* quota */
    }
  }
  memoryStore.set(key, str)
  return true
}

export async function piLocalRemove(key: string): Promise<void> {
  assertSafeKey(key)
  const api = getPiStorageApi()
  if (api?.removeItem) {
    try {
      await Promise.resolve(api.removeItem(key))
    } catch {
      /* */
    }
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(webKey(key))
    } catch {
      /* */
    }
  }
  memoryStore.delete(key)
}

export async function piLocalGetJson<T>(key: string): Promise<T | null> {
  const raw = await piLocalGet(key)
  if (raw == null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function piLocalSetJson(key: string, value: unknown): Promise<boolean> {
  return piLocalSet(key, JSON.stringify(value))
}

/** Well-known UX keys (non-authoritative) */
export const PI_LS_KEYS = {
  theme: "ux.theme",
  tipsDismissed: "ux.tips_dismissed",
  lastTab: "ux.last_tab",
  feedDensity: "ux.feed_density",
  draftPost: "ux.draft_post",
  lockPolicyPref: "ux.lock_policy_pref",
} as const
