/**
 * Client helpers for optional Passkey/WebAuthn (Phase 7).
 * Pi authentication remains primary identity bootstrap.
 */

"use client"

export async function browserSupportsWebAuthn(): Promise<boolean> {
  try {
    if (typeof window === "undefined") return false
    if (!window.PublicKeyCredential) return false
    // Secure context required
    if (!window.isSecureContext && location.hostname !== "localhost") return false
    return true
  } catch {
    return false
  }
}

export async function registerPasskey(label?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { startRegistration } = await import("@simplewebauthn/browser")
    const optRes = await fetch("/api/auth/webauthn/register/options", {
      method: "POST",
      credentials: "include",
    })
    const optData = await optRes.json().catch(() => ({}))
    if (!optRes.ok || !optData.ok) {
      return { ok: false, error: optData.error || "OPTIONS_FAILED" }
    }
    const attResp = await startRegistration({ optionsJSON: optData.options })
    const verRes = await fetch("/api/auth/webauthn/register/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: attResp, label }),
    })
    const verData = await verRes.json().catch(() => ({}))
    if (!verRes.ok || !verData.ok) {
      return { ok: false, error: verData.error || "VERIFY_FAILED" }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "REGISTER_FAILED",
    }
  }
}

/** Authenticate passkey and establish server step-up */
export async function authenticatePasskeyStepUp(): Promise<{
  ok: boolean
  error?: string
  expiresAt?: number
}> {
  try {
    const { startAuthentication } = await import("@simplewebauthn/browser")
    const optRes = await fetch("/api/auth/webauthn/authenticate/options", {
      method: "POST",
      credentials: "include",
    })
    const optData = await optRes.json().catch(() => ({}))
    if (!optRes.ok || !optData.ok) {
      return { ok: false, error: optData.error || "OPTIONS_FAILED" }
    }
    const authResp = await startAuthentication({ optionsJSON: optData.options })
    const verRes = await fetch("/api/auth/webauthn/authenticate/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: authResp }),
    })
    const verData = await verRes.json().catch(() => ({}))
    if (!verRes.ok || !verData.ok) {
      return { ok: false, error: verData.error || "VERIFY_FAILED" }
    }
    return { ok: true, expiresAt: verData.stepUp?.expiresAt }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "AUTH_FAILED",
    }
  }
}
