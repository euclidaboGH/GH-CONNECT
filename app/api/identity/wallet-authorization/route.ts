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
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
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
  const limit = checkRateLimit(`wallet-auth-get:${auth.userId}`, 60, 60_000)
  if (!limit.ok) return reply({ ok: false, error: "RATE_LIMITED" }, 429)
  const status = await getWalletAuthorization(auth.userId)
  if (!status.ok && status.error === "WALLET_AUTHORIZATION_UNAVAILABLE") {
    return reply({ ok: false, error: "WALLET_AUTHORIZATION_UNAVAILABLE" }, 503)
  }
  return reply({ ...status, ok: true })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const limit = checkRateLimit(`wallet-auth-grant:${auth.userId}`, 10, 60_000)
  if (!limit.ok) return reply({ ok: false, error: "RATE_LIMITED" }, 429)

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
    },
    { verifyPiAccessToken, getByGhUserId, getByPiAppUid },
  )
  if (!proof.ok) {
    console.info("[wallet-authorization] consent rejected", { reason: proof.error })
    return reply({
      ok: false,
      error: proof.error,
      message: WALLET_CONSENT_MESSAGES[proof.error],
      retryable: proof.error !== "IDENTITY_MISMATCH" && proof.error !== "IDENTITY_MAPPING_REQUIRED",
    }, walletConsentFailureStatus(proof.error))
  }
  const mapping = { piAppUid: proof.piAppUid }

  const granted = await grantWalletAuthorization({
    ghUserId: auth.userId,
    piAppUid: mapping.piAppUid,
    source: "user_explicit",
  })
  if (!granted.ok) {
    const status = granted.error === "WALLET_AUTHORIZATION_UNAVAILABLE" ? 503 : 409
    return reply({
      ok: false,
      error: granted.error === "WALLET_AUTHORIZATION_UNAVAILABLE" ? "WALLET_AUTHORIZATION_UNAVAILABLE" : "AUTHORIZATION_SAVE_FAILED",
      message: "Wallet authorization could not be saved. Please retry Pi authentication.",
      ...(granted.diagnosticCode ? { diagnosticCode: granted.diagnosticCode } : {}),
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
    verified.authorizedPiAppUid !== mapping.piAppUid
  ) {
    return reply({
      ok: false,
      error: verified.error || "AUTHORIZATION_NOT_CONFIRMED",
      message: "Consent was submitted but the active authorization could not be independently verified. Withdrawals remain blocked.",
    }, verified.error === "WALLET_AUTHORIZATION_UNAVAILABLE" ? 503 : 409)
  }

  return reply({
    ok: true,
    authorizationId: verified.authorizationId || granted.authorizationId,
    piAppUid: verified.authorizedPiAppUid,
    status: "active",
    authorizationActive: true,
    uidMatchesAuthorization: true,
    message: "Pi wallet authorization granted and verified for App-to-User payouts to your linked identity.",
  })
}

export async function DELETE(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const limit = checkRateLimit(`wallet-auth-revoke:${auth.userId}`, 10, 60_000)
  if (!limit.ok) return reply({ ok: false, error: "RATE_LIMITED" }, 429)

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
