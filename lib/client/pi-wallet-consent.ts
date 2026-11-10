"use client"

/**
 * Genuine Pi wallet consent for withdrawals.
 *
 * Sequence (all steps must succeed, otherwise nothing is authorized):
 *  1. Pi.authenticate() through the official SDK (fresh consent screen in Pi Browser)
 *  2. POST the fresh accessToken + explicit consent to the server
 *  3. Server verifies the token with the Pi Platform, matches it to the durable
 *     identity mapping of the signed-in GreenHaven account, then records consent
 *  4. Client re-reads the authorization from the database-backed status endpoint
 *
 * The access token is held in memory only for the single request; it is never
 * stored, logged or put in any URL.
 */

import { piAuthenticateOfficial } from "@/lib/pi-runtime"

export type WalletConsentErrorCode =
  | "PI_AUTH_CANCELLED"
  | "PI_AUTH_UNAVAILABLE"
  | "PI_TOKEN_REQUIRED"
  | "PI_TOKEN_INVALID"
  | "IDENTITY_MISMATCH"
  | "IDENTITY_MAPPING_REQUIRED"
  | "IDENTITY_LOOKUP_UNAVAILABLE"
  | "CONSENT_REQUIRED"
  | "AUTH_REQUIRED"
  | "RATE_LIMITED"
  | "AUTHORIZATION_SAVE_FAILED"
  | "AUTHORIZATION_NOT_CONFIRMED"
  | "WALLET_AUTHORIZATION_UNAVAILABLE"
  | "NETWORK_ERROR"

export type WalletAuthorizationStatus = {
  authorizationActive: boolean
  uidMatchesAuthorization: boolean
  hasMapping: boolean
  mappedUsername: string | null
  authorizedPiAppUid?: string | null
}

export type WalletConsentResult =
  | { ok: true; status: WalletAuthorizationStatus }
  | { ok: false; code: WalletConsentErrorCode; message: string; retryable: boolean }

const MESSAGES: Record<WalletConsentErrorCode, string> = {
  PI_AUTH_CANCELLED: "Pi authentication was cancelled. No authorization was saved and no withdrawal was started.",
  PI_AUTH_UNAVAILABLE: "Pi authentication is only available inside Pi Browser. Open GreenHaven there and try again.",
  PI_TOKEN_REQUIRED: "Pi authentication is required. Please retry Pi authentication.",
  PI_TOKEN_INVALID: "Pi authentication could not be verified. Please retry Pi authentication.",
  IDENTITY_MISMATCH: "Your authenticated Pi account does not match the Pi account linked to this GreenHaven account.",
  IDENTITY_MAPPING_REQUIRED: "Sign in with Pi so GreenHaven can link your Pi identity before authorizing withdrawals.",
  IDENTITY_LOOKUP_UNAVAILABLE: "Identity verification is temporarily unavailable. Withdrawals remain blocked; please try again shortly.",
  CONSENT_REQUIRED: "Please confirm the consent checkbox to authorize your Pi wallet.",
  AUTH_REQUIRED: "Please sign in again, then retry.",
  RATE_LIMITED: "Too many attempts. Please wait a moment and retry.",
  AUTHORIZATION_SAVE_FAILED: "Wallet authorization could not be saved. Please retry Pi authentication.",
  AUTHORIZATION_NOT_CONFIRMED: "Wallet authorization could not be confirmed yet. Withdrawals remain blocked. Please retry.",
  WALLET_AUTHORIZATION_UNAVAILABLE: "Wallet authorization is temporarily unavailable. Withdrawals remain blocked.",
  NETWORK_ERROR: "Network error while authorizing. No transfer was started. Please retry.",
}

const NON_RETRYABLE: ReadonlySet<WalletConsentErrorCode> = new Set([
  "IDENTITY_MISMATCH",
  "IDENTITY_MAPPING_REQUIRED",
  "PI_AUTH_UNAVAILABLE",
])

function fail(code: WalletConsentErrorCode): WalletConsentResult {
  return { ok: false, code, message: MESSAGES[code], retryable: !NON_RETRYABLE.has(code) }
}

function normalizeCode(raw: unknown): WalletConsentErrorCode {
  const c = typeof raw === "string" ? raw : ""
  return (c in MESSAGES ? c : "AUTHORIZATION_SAVE_FAILED") as WalletConsentErrorCode
}

/** Database-backed status read. Never cached; never trusts a browser flag. */
export async function fetchWalletAuthorizationStatus(signal?: AbortSignal): Promise<
  { ok: true; status: WalletAuthorizationStatus } | { ok: false; code: WalletConsentErrorCode }
> {
  try {
    const res = await fetch("/api/identity/wallet-authorization", {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    })
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean
      error?: string
      authorizationActive?: boolean
      uidMatchesAuthorization?: boolean
      hasMapping?: boolean
      mappedUsername?: string | null
      authorizedPiAppUid?: string | null
    } | null
    if (!res.ok || body?.ok !== true) {
      return { ok: false, code: res.status === 401 ? "AUTH_REQUIRED" : normalizeCode(body?.error ?? "WALLET_AUTHORIZATION_UNAVAILABLE") }
    }
    const uidMatches = body.uidMatchesAuthorization === true
    return {
      ok: true,
      status: {
        authorizationActive: body.authorizationActive === true && uidMatches,
        uidMatchesAuthorization: uidMatches,
        hasMapping: body.hasMapping === true,
        mappedUsername: body.mappedUsername ?? null,
        authorizedPiAppUid: body.authorizedPiAppUid ?? null,
      },
    }
  } catch {
    return { ok: false, code: "NETWORK_ERROR" }
  }
}

type ConsentPostResponse = { status: number; body: { ok?: boolean; error?: string } | null }

/** The access token only lives in this call's request body; it is never retained. */
async function postConsent(accessToken: string): Promise<ConsentPostResponse | null> {
  try {
    const res = await fetch("/api/identity/wallet-authorization", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, consent: true }),
    })
    const body = (await res.json().catch(() => null)) as ConsentPostResponse["body"]
    return { status: res.status, body }
  } catch {
    return null
  }
}

/**
 * Run the full consent flow. Call ONLY from an explicit user gesture after the
 * consent checkbox is ticked.
 */
export async function requestPiWalletConsent(): Promise<WalletConsentResult> {
  let accessToken: string | null
  try {
    // Scopes must match the app's sign-in scopes so the Pi SDK returns a token
    // the platform can verify for this app's UID.
    const pi = await piAuthenticateOfficial(["username", "payments"])
    accessToken = pi.accessToken
  } catch (err) {
    const msg = err instanceof Error ? err.message : ""
    if (/not available|not defined|undefined/i.test(msg)) return fail("PI_AUTH_UNAVAILABLE")
    // The Pi SDK rejects when the user dismisses the consent screen.
    return fail("PI_AUTH_CANCELLED")
  }
  if (!accessToken) return fail("PI_TOKEN_REQUIRED")

  const response = await postConsent(accessToken)
  if (!response) return fail("NETWORK_ERROR")
  const { status, body } = response

  if (status === 401 && body?.error === "AUTH_REQUIRED") return fail("AUTH_REQUIRED")
  if (status === 429) return fail("RATE_LIMITED")
  if (status < 200 || status >= 300 || body?.ok !== true) return fail(normalizeCode(body?.error))

  // Independent confirmation from the database-backed status endpoint.
  const verified = await fetchWalletAuthorizationStatus()
  if (!verified.ok) return fail(verified.code === "NETWORK_ERROR" ? "NETWORK_ERROR" : "AUTHORIZATION_NOT_CONFIRMED")
  if (!verified.status.authorizationActive || !verified.status.uidMatchesAuthorization) {
    return fail("AUTHORIZATION_NOT_CONFIRMED")
  }

  try {
    window.dispatchEvent(new CustomEvent("ghc:wallet-auth-changed", { detail: { active: true } }))
    window.dispatchEvent(new CustomEvent("ghc:wallet-refresh"))
    window.dispatchEvent(new CustomEvent("ghc:earnings-refresh"))
  } catch { /* non-fatal UI refresh */ }
  return { ok: true, status: verified.status }
}
