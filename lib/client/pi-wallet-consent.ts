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
  | "PI_WALLET_ADDRESS_REQUIRED"
  | "PI_WALLET_ADDRESS_INVALID"
  | "PI_WALLET_ADDRESS_MISMATCH"
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
  piWalletAddress?: string | null
  walletAddressSource?: "platform_api" | "pi_sdk_scope" | "provider_payment" | null
  walletAddressVerifiedAt?: string | null
}

export type WalletConsentResult =
  | { ok: true; status: WalletAuthorizationStatus }
  | { ok: false; code: WalletConsentErrorCode; message: string; retryable: boolean }

const MESSAGES: Record<WalletConsentErrorCode, string> = {
  PI_AUTH_CANCELLED: "Pi authentication was cancelled. No authorization was saved and no withdrawal was started.",
  PI_AUTH_UNAVAILABLE: "Pi authentication bridge is not ready. Stay in Pi Browser and retry. If this persists, reopen the app from Pi → Develop.",
  PI_TOKEN_REQUIRED: "Pi authentication is required. Please retry Pi authentication.",
  PI_TOKEN_INVALID: "Pi authentication could not be verified. Please retry Pi authentication.",
  PI_WALLET_ADDRESS_REQUIRED: "Pi signed you in but did not grant GreenHaven the wallet-address permission. No authorization or withdrawal was created. In Pi Browser, open GreenHaven using the registered app link, approve the wallet-address permission when Pi asks, and retry. If Pi does not ask again, review GreenHaven's permissions in Pi Browser and re-enable wallet access. Never enter or substitute a wallet address manually.",
  PI_WALLET_ADDRESS_INVALID: "Pi returned an invalid wallet address. No payout authorization was changed.",
  PI_WALLET_ADDRESS_MISMATCH: "Pi returned conflicting wallet details. No payout authorization was changed.",
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
      piWalletAddress?: string | null
      walletAddressSource?: "platform_api" | "pi_sdk_scope" | "provider_payment" | null
      walletAddressVerifiedAt?: string | null
    } | null
    if (!res.ok || body?.ok !== true) {
      return { ok: false, code: res.status === 401 ? "AUTH_REQUIRED" : normalizeCode(body?.error ?? "WALLET_AUTHORIZATION_UNAVAILABLE") }
    }
    const uidMatches = body.uidMatchesAuthorization === true
    return {
      ok: true,
      status: {
        authorizationActive: body.authorizationActive === true && uidMatches && Boolean(body.piWalletAddress && body.walletAddressSource),
        uidMatchesAuthorization: uidMatches,
        hasMapping: body.hasMapping === true,
        mappedUsername: body.mappedUsername ?? null,
        authorizedPiAppUid: body.authorizedPiAppUid ?? null,
        piWalletAddress: body.piWalletAddress ?? null,
        walletAddressSource: body.walletAddressSource ?? null,
        walletAddressVerifiedAt: body.walletAddressVerifiedAt ?? null,
      },
    }
  } catch {
    return { ok: false, code: "NETWORK_ERROR" }
  }
}

type ConsentPostResponse = { status: number; body: { ok?: boolean; error?: string } | null }

/** The access token only lives in this call's request body; it is never retained. */
async function postConsent(accessToken: string, walletAddress: string | null): Promise<ConsentPostResponse | null> {
  try {
    const res = await fetch("/api/identity/wallet-authorization", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, consent: true, walletAddress }),
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
    // Request only the additional permission this action needs. Pi's app-local
    // UID is returned without a scope; username and payments are not required
    // to bind a public wallet address. A2U remains server-initiated and UID-routed.
    // The server independently verifies this fresh token with Pi /v2/me.
    // Never broaden this request to username or payments: a wallet withdrawal
    // needs only wallet_address, and missing scope must fail closed.
    const pi = await piAuthenticateOfficial(["wallet_address"]).catch(() => null)
    if (!pi?.accessToken) return fail("PI_TOKEN_REQUIRED")
    accessToken = pi.accessToken
    const walletAddress = String(pi.walletAddress || "").trim().toUpperCase() || null
    if (walletAddress && !/^G[A-Z2-7]{55}$/.test(walletAddress)) return fail("PI_WALLET_ADDRESS_INVALID")
    // Missing SDK data is not conclusive; the server verifies the token with Pi /v2/me.
    const response = await postConsent(accessToken, walletAddress)
    if (!response) return fail("NETWORK_ERROR")
    const { status, body } = response
    if (status === 401 && body?.error === "AUTH_REQUIRED") return fail("AUTH_REQUIRED")
    if (status === 429) return fail("RATE_LIMITED")
    if (status < 200 || status >= 300 || body?.ok !== true) return fail(normalizeCode(body?.error))
    const verified = await fetchWalletAuthorizationStatus()
    if (!verified.ok) return fail(verified.code === "NETWORK_ERROR" ? "NETWORK_ERROR" : "AUTHORIZATION_NOT_CONFIRMED")
    if (!verified.status.authorizationActive || !verified.status.uidMatchesAuthorization) return fail("AUTHORIZATION_NOT_CONFIRMED")
    try {
      window.dispatchEvent(new CustomEvent("ghc:wallet-auth-changed", { detail: { active: true } }))
      window.dispatchEvent(new CustomEvent("ghc:wallet-refresh"))
      window.dispatchEvent(new CustomEvent("ghc:earnings-refresh"))
    } catch { /* non-fatal UI refresh */ }
    return { ok: true, status: verified.status }
  } catch (err) {
    const msg = err instanceof Error ? err.message : ""
    if (/not available|not defined|undefined/i.test(msg)) return fail("PI_AUTH_UNAVAILABLE")
    // The Pi SDK rejects when the user dismisses the consent screen.
    return fail("PI_AUTH_CANCELLED")
  }
}
