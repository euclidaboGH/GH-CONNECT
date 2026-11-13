/**
 * Phase 2 — explicit Pi wallet authorization for A2U payouts.
 * GET: status for authenticated user
 * POST: grant consent. Requires explicit consent + a fresh Pi accessToken verified
 *       server-side against the durable identity mapping. Never trusts a body UID,
 *       a body user id, or any client "authorized" flag.
 * DELETE: revoke active consent
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser, verifyPiAccessToken } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { getByGhUserId, getByPiAppUid } from "@/lib/server/identity/pi-identity-store"
import {
  verifyWalletConsentProof,
  WALLET_CONSENT_MESSAGES,
  walletConsentFailureStatus,
} from "@/lib/server/identity/wallet-consent"
import {
  getWalletAuthorization,
  grantWalletAuthorization,
  revokeWalletAuthorization,
} from "@/lib/server/identity/wallet-authorization"

import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore })
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const limit = await checkDurableRateLimit(`wallet-auth-get:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
  if (!limit.ok) return reply({ ok: false, error: durableRateLimitCode(limit) }, durableRateLimitStatus(limit))
  const status = await getWalletAuthorization(auth.userId)
  if (!status.ok) return reply({ ok: false, error: status.error || "WALLET_AUTHORIZATION_UNAVAILABLE" }, status.error === "INVALID_INPUT" ? 400 : 503)
  return reply({ ...status, ok: true })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const limit = await checkDurableRateLimit(`wallet-auth-grant:${auth.userId}`, 10, 60_000, { onUnavailable: "deny" })
  if (!limit.ok) return reply({ ok: false, error: durableRateLimitCode(limit) }, durableRateLimitStatus(limit))

  const parsedBody = await readBoundedJson(request, 8 * 1024)
  if (!parsedBody.ok) {
    return reply(
      { ok: false, error: parsedBody.error === "REQUEST_TOO_LARGE" ? "REQUEST_TOO_LARGE" : "INVALID_JSON" },
      parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400,
    )
  }

  // Fresh Pi proof + explicit consent. The recipient UID is derived ONLY from the
  // Pi-verified identity that must equal the durable mapping of the session user.
  const proof = await verifyWalletConsentProof(
    {
      ghUserId: auth.userId,
      accessToken: parsedBody.value.accessToken,
      consent: parsedBody.value.consent,
      walletAddress: parsedBody.value.walletAddress,
    },
    { verifyPiAccessToken, getByGhUserId, getByPiAppUid },
  )
  if (!proof.ok) {
    const requestId = String(request.headers.get("x-vercel-id") || request.headers.get("x-request-id") || "").slice(0, 128)
    console.info("[wallet-authorization] consent rejected", { stage: "PI_PROOF", reason: proof.error, requestId: requestId || undefined })
    return reply({
      ok: false,
      error: proof.error,
      message: WALLET_CONSENT_MESSAGES[proof.error],
      retryable: proof.error !== "IDENTITY_MISMATCH" && proof.error !== "IDENTITY_MAPPING_REQUIRED",
    }, walletConsentFailureStatus(proof.error))
  }
  const mapping = { piAppUid: proof.piAppUid, piWalletAddress: proof.piWalletAddress, walletAddressSource: proof.walletAddressSource }

  const granted = await grantWalletAuthorization({
    ghUserId: auth.userId,
    piAppUid: mapping.piAppUid,
    piWalletAddress: mapping.piWalletAddress,
    walletAddressSource: mapping.walletAddressSource,
    source: "user_explicit",
  })
  if (!granted.ok) {
    const knownGrantErrors = new Set([
      "WALLET_AUTHORIZATION_UNAVAILABLE", "INVALID_INPUT", "INVALID_SOURCE",
      "IDENTITY_MAPPING_REQUIRED", "IDENTITY_MAPPING_MISMATCH", "PI_WALLET_ADDRESS_REQUIRED",
      "PI_WALLET_ADDRESS_PROOF_REQUIRED", "PI_WALLET_ADDRESS_UNVERIFIED", "GRANT_RESPONSE_MISMATCH",
    ])
    const publicError = knownGrantErrors.has(String(granted.error)) ? String(granted.error) : "AUTHORIZATION_SAVE_FAILED"
    const status = publicError === "WALLET_AUTHORIZATION_UNAVAILABLE" ? 503 : publicError === "INVALID_INPUT" ? 400 : publicError === "IDENTITY_MAPPING_MISMATCH" ? 403 : 409
    const requestId = String(request.headers.get("x-vercel-id") || request.headers.get("x-request-id") || "").slice(0, 128)
    console.error("[wallet-authorization] grant failed", {
      stage: "GRANT_RPC", diagnosticCode: publicError,
      upstreamStatus: typeof granted.httpStatus === "number" ? granted.httpStatus : undefined,
      requestId: requestId || undefined,
    })
    const grantMessages: Record<string, string> = {
      PI_WALLET_ADDRESS_REQUIRED: WALLET_CONSENT_MESSAGES.PI_WALLET_ADDRESS_REQUIRED,
      PI_WALLET_ADDRESS_UNVERIFIED: WALLET_CONSENT_MESSAGES.PI_WALLET_ADDRESS_UNVERIFIED,
      IDENTITY_MAPPING_REQUIRED: WALLET_CONSENT_MESSAGES.IDENTITY_MAPPING_REQUIRED,
      IDENTITY_MAPPING_MISMATCH: WALLET_CONSENT_MESSAGES.IDENTITY_MISMATCH,
      INVALID_INPUT: "The authorization request was incomplete. Please restart Pi authorization.",
      GRANT_RESPONSE_MISMATCH: "Pi authorization could not be independently confirmed. Withdrawals remain blocked; please retry.",
    }
    return reply({
      ok: false,
      error: publicError,
      message: grantMessages[publicError] || "Wallet authorization could not be saved. Please retry Pi authentication.",
      diagnosticCode: publicError,
      ...(typeof granted.httpStatus === "number" ? { upstreamStatus: granted.httpStatus } : {}),
    }, status)
  }

  // A successful grant RPC is not sufficient to unlock the UI. Read the
  // authorization back through the independent status RPC and require an
  // active record for the exact currently mapped Pi UID.
  const verified = await getWalletAuthorization(auth.userId)
  if (
    !verified.ok ||
    verified.authorizationActive !== true ||
    verified.uidMatchesAuthorization !== true ||
    verified.authorizedPiAppUid !== mapping.piAppUid ||
    verified.piWalletAddress !== mapping.piWalletAddress ||
    verified.walletAddressSource !== mapping.walletAddressSource ||
    verified.walletAddressSource !== "platform_api" ||
    !verified.walletAddressVerifiedAt
  ) {
    const readbackCode = verified.error || (
      verified.uidMatchesAuthorization !== true || verified.authorizedPiAppUid !== mapping.piAppUid
        ? "IDENTITY_MISMATCH"
        : verified.piWalletAddress !== mapping.piWalletAddress
          ? "PI_WALLET_ADDRESS_MISMATCH"
          : verified.walletAddressSource !== "platform_api" || !verified.walletAddressVerifiedAt
            ? "PI_WALLET_ADDRESS_UNVERIFIED"
            : verified.authorizationReason || "AUTHORIZATION_NOT_CONFIRMED"
    )
    const knownReadbackErrors = new Set([
      "WALLET_AUTHORIZATION_UNAVAILABLE", "IDENTITY_MAPPING_REQUIRED", "IDENTITY_MISMATCH",
      "PI_WALLET_ADDRESS_REQUIRED", "PI_WALLET_ADDRESS_UNVERIFIED", "PI_WALLET_ADDRESS_MISMATCH",
      "AUTHORIZATION_NOT_CONFIRMED",
    ])
    const diagnosticCode = knownReadbackErrors.has(readbackCode) ? readbackCode : "AUTHORIZATION_NOT_CONFIRMED"
    const requestId = String(request.headers.get("x-vercel-id") || request.headers.get("x-request-id") || "").slice(0, 128)
    console.error("[wallet-authorization] independent read-back failed", {
      stage: "READ_BACK", diagnosticCode, requestId: requestId || undefined,
    })
    const status = diagnosticCode === "WALLET_AUTHORIZATION_UNAVAILABLE" ? 503 : diagnosticCode === "IDENTITY_MISMATCH" ? 403 : 409
    return reply({
      ok: false,
      error: diagnosticCode,
      diagnosticCode,
      message: "Consent was submitted but the active authorization could not be independently verified. Withdrawals remain blocked.",
    }, status)
  }

  return reply({
    ok: true,
    authorizationId: verified.authorizationId || granted.authorizationId,
    piAppUid: verified.authorizedPiAppUid,
    piWalletAddress: verified.piWalletAddress,
    walletAddressSource: verified.walletAddressSource,
    walletAddressVerifiedAt: verified.walletAddressVerifiedAt,
    status: "active",
    authorizationActive: true,
    uidMatchesAuthorization: true,
    message: "Pi wallet authorization granted and verified for App-to-User payouts to your linked identity.",
  })
}

export async function DELETE(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const limit = await checkDurableRateLimit(`wallet-auth-revoke:${auth.userId}`, 10, 60_000, { onUnavailable: "deny" })
  if (!limit.ok) return reply({ ok: false, error: durableRateLimitCode(limit) }, durableRateLimitStatus(limit))

  let reason = "user_revoked"
  const parsedBody = await readBoundedJson(request, 4 * 1024)
  if (parsedBody.ok && typeof parsedBody.value.reason === "string") {
    reason = parsedBody.value.reason.slice(0, 120)
  } else if (!parsedBody.ok && parsedBody.error !== "INVALID_BODY") {
    return reply({ ok: false, error: parsedBody.error }, parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  }

  const revoked = await revokeWalletAuthorization({ ghUserId: auth.userId, reason })
  if (!revoked.ok && revoked.error === "WALLET_AUTHORIZATION_UNAVAILABLE") {
    return reply({ ok: false, error: "WALLET_AUTHORIZATION_UNAVAILABLE" }, 503)
  }
  return reply({
    ok: true,
    revoked: revoked.revoked === true,
    status: revoked.revoked ? "revoked" : "none",
  })
}
