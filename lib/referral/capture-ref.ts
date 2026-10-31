/**
 * Client helpers: persist ?ref= from invite links and attribute after auth.
 */
const STORAGE_KEY = "ghc.referral.pendingCode"

export function captureReferralCodeFromLocation(search?: string): string | null {
  if (typeof window === "undefined") return null
  try {
    const q = search ?? window.location.search
    const params = new URLSearchParams(q.startsWith("?") ? q : `?${q}`)
    const raw = params.get("ref") || params.get("referral") || params.get("invite")
    if (!raw) return null
    const code = String(raw).trim().toUpperCase().slice(0, 32)
    if (code.length < 2) return null
    window.localStorage.setItem(STORAGE_KEY, code)
    return code
  } catch {
    return null
  }
}

export function peekPendingReferralCode(): string | null {
  if (typeof window === "undefined") return null
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v && v.trim() ? v.trim().toUpperCase() : null
  } catch {
    return null
  }
}

export function clearPendingReferralCode(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* */
  }
}

/** POST attribute for pending code; clears storage on success or permanent failure. */
export async function flushPendingReferralAttribution(
  getAuthHeaders?: () => Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  const code = peekPendingReferralCode()
  if (!code) return { ok: true }
  try {
    const res = await fetch("/api/referral/attribute", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(getAuthHeaders?.() || {}),
      },
      body: JSON.stringify({ code }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data?.ok) {
      clearPendingReferralCode()
      return { ok: true }
    }
    if (res.status === 400) {
      clearPendingReferralCode()
      return { ok: false, error: String(data?.error || "INVALID") }
    }
    return { ok: false, error: String(data?.error || "TEMP_FAIL") }
  } catch {
    return { ok: false, error: "NETWORK" }
  }
}
