/**
 * Client helper for Phase 4 server step-up.
 * App Lock unlock does NOT call this.
 * Sensitive ops should call ensureServerStepUp() after Pi.authenticate refreshes the token.
 */

"use client"

/**
 * Establish server-side step-up using a fresh Pi accessToken.
 * Requires existing GH session cookie (credentials: include).
 */
export async function establishServerStepUp(
  accessToken: string
): Promise<{ ok: boolean; error?: string; expiresAt?: number }> {
  const token = String(accessToken || "").trim()
  if (!token) return { ok: false, error: "accessToken required" }

  try {
    const res = await fetch("/api/auth/step-up", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: token }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      stepUp?: { expiresAt?: number }
    }
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || "STEP_UP_FAILED" }
    }
    return { ok: true, expiresAt: data.stepUp?.expiresAt }
  } catch {
    return { ok: false, error: "NETWORK_ERROR" }
  }
}

/** True if API error indicates step-up is required */
export function isStepUpRequiredError(code: string | undefined | null): boolean {
  return (
    code === "STEP_UP_REQUIRED" ||
    code === "STEP_UP_EXPIRED" ||
    code === "SESSION_REQUIRED"
  )
}
