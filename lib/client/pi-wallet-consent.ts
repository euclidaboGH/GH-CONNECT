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
  | "PI_WALLET_ADDRESS_UNVERIFIED"
  | "PI_WALLET_ADDRESS_INVALID"
  | "PI_WALLET_ADDRESS_MISMATCH"
  | "PI_WALLET_SCOPE_NOT_GRANTED"
  | "WALLET_SCOPE_MIGRATION_REQUIRED"
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
  /** Set once the server verified the wallet_address scope grant with Pi. */
  walletScopeVerifiedAt?: string | null
  /** True while Pi has not yet supplied the destination (confirmed at first payout). */
  walletAddressPending?: boolean
  authorizationReason?: string | null
}

export type WalletConsentResult =
  | { ok: true; status: WalletAuthorizationStatus }
  | { ok: false; code: WalletConsentErrorCode; message: string; retryable: boolean }

const MESSAGES: Record<WalletConsentErrorCode, string> = {
  PI_AUTH_CANCELLED: "Pi authentication was cancelled. No authorization was saved and no withdrawal was started.",
  PI_AUTH_UNAVAILABLE: "Pi authentication bridge is not ready. Stay in Pi Browser and retry. If this persists, reopen the app from Pi → Develop.",
  PI_TOKEN_REQUIRED: "Pi authentication is required. Please retry Pi authentication.",
  PI_TOKEN_INVALID: "Pi authentication could not be verified. Please retry Pi authentication.",
  PI_WALLET_ADDRESS_REQUIRED: "Pi did not confirm wallet-address access for this account. No authorization or withdrawal was created. Reopen the registered GreenHaven app in Pi Browser and approve wallet-address access. If Pi does not prompt, confirm wallet_address is enabled for GreenHaven in the Pi Developer Portal.",
  WALLET_SCOPE_MIGRATION_REQUIRED: "Pi confirmed your wallet permission, but GreenHaven's payout database has not been upgraded yet. Nothing was changed and no Pi was reserved. Please try again after the upgrade.",
  PI_WALLET_SCOPE_NOT_GRANTED: "Pi did not report wallet-address permission for this sign-in. No authorization or withdrawal was created. Retry, tap Allow on the wallet-address prompt, and confirm wallet_address is enabled for GreenHaven in the Pi Developer Portal.",
  PI_WALLET_ADDRESS_UNVERIFIED: "Pi returned an address in the browser, but its Platform API did not independently verify it. Check that wallet_address permission is enabled for GreenHaven in the Pi Developer Portal, then retry in Pi Browser. No withdrawal was started.",
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
  "PI_WALLET_ADDRESS_UNVERIFIED",
])

function fail(code: WalletConsentErrorCode): WalletConsentResult {
  return { ok: false, code, message: MESSAGES[code], retryable: !NON_RETRYABLE.has(code) }
}

function normalizeCode(raw: unknown): WalletConsentErrorCode {
  const c = typeof raw === "string" ? raw : ""
  return (Object.hasOwn(MESSAGES, c) ? c : "AUTHORIZATION_SAVE_FAILED") as WalletConsentErrorCode
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
      signal: signal || AbortSignal.timeout(12_000),
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
      walletScopeVerifiedAt?: string | null
      walletAddressPending?: boolean
      authorizationReason?: string | null
    } | null
    if (!res.ok || body?.ok !== true) {
      return { ok: false, code: res.status === 401 ? "AUTH_REQUIRED" : normalizeCode(body?.error ?? "WALLET_AUTHORIZATION_UNAVAILABLE") }
    }
    const uidMatches = body.uidMatchesAuthorization === true
    return {
      ok: true,
      status: {
        // Active = server-verified wallet_address scope for the mapped UID. A bound
        // address, when present, must carry a known source; a pending address is
        // confirmed from Pi's PaymentDTO.to_address at the first payout.
        authorizationActive: body.authorizationActive === true && uidMatches && Boolean(body.walletScopeVerifiedAt) && (!body.piWalletAddress || Boolean(body.walletAddressSource)),
        uidMatchesAuthorization: uidMatches,
        hasMapping: body.hasMapping === true,
        mappedUsername: body.mappedUsername ?? null,
        authorizedPiAppUid: body.authorizedPiAppUid ?? null,
        piWalletAddress: body.piWalletAddress ?? null,
        walletAddressSource: body.walletAddressSource ?? null,
        walletAddressVerifiedAt: body.walletAddressVerifiedAt ?? null,
        walletScopeVerifiedAt: body.walletScopeVerifiedAt ?? null,
        walletAddressPending: body.walletAddressPending === true,
        authorizationReason: body.authorizationReason ?? null,
      },
    }
  } catch {
    return { ok: false, code: "NETWORK_ERROR" }
  }
}

type ConsentPostResponse = {
  status: number
  body: { ok?: boolean; error?: string; stage?: string; diagnosticCode?: string; build?: string } | null
}

/** Append a short, secret-free diagnostic (build, stage, code, HTTP status) to a failure. */
function failWithDiagnostic(code: WalletConsentErrorCode, status: number, body: ConsentPostResponse["body"]): WalletConsentResult {
  const safe = (v: unknown) => (typeof v === "string" ? v.replace(/[^A-Za-z0-9_.:-]/g, "").slice(0, 48) : "")
  const parts = [safe(body?.build), safe(body?.stage), safe(body?.diagnosticCode) || safe(body?.error), status ? `HTTP${status}` : ""].filter(Boolean)
  const base = fail(code)
  if (!base.ok && parts.length) return { ...base, message: `${base.message} (diagnostic: ${parts.join(" · ")})` }
  return base
}

/** The access token only lives in this call's request body; it is never retained. */
async function postConsent(accessToken: string, walletAddress: string | null): Promise<ConsentPostResponse | null> {
  try {
    const res = await fetch("/api/identity/wallet-authorization", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, consent: true, walletAddress }),
      signal: AbortSignal.timeout(15_000),
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
let consentInFlight: Promise<WalletConsentResult> | null = null

export function requestPiWalletConsent(): Promise<WalletConsentResult> {
  if (consentInFlight) return consentInFlight
  consentInFlight = performPiWalletConsent().finally(() => { consentInFlight = null })
  return consentInFlight
}

async function performPiWalletConsent(): Promise<WalletConsentResult> {
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
    // A missing SDK address is not an error: the server verifies the granted scope
    // with Pi /v2/me, and Pi's A2U PaymentDTO supplies the destination at payout.
    const response = await postConsent(accessToken, walletAddress)
    if (!response) return fail("NETWORK_ERROR")
    const { status, body } = response
    if (status === 401 && body?.error === "AUTH_REQUIRED") return fail("AUTH_REQUIRED")
    if (status === 429) return fail("RATE_LIMITED")
    if (status < 200 || status >= 300 || body?.ok !== true) return failWithDiagnostic(normalizeCode(body?.error), status, body)
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
