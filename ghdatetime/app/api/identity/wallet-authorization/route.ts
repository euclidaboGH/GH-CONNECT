/**
 * Phase 2 — explicit Pi wallet authorization for A2U payouts.
 * GET: status for authenticated user
 * POST: grant consent (uses server mapping only; never trusts body recipient)
 * DELETE: revoke active consent
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { getByGhUserId } from "@/lib/server/identity/pi-identity-store"
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

  // Recipient comes only from durable verified mapping — never from the client body.
  const mapping = await getByGhUserId(auth.userId)
  if (!mapping?.piAppUid) {
    return reply({
      ok: false,
      error: "IDENTITY_MAPPING_REQUIRED",
      message: "Sign in with Pi so GreenHaven can verify your app identity before authorizing payouts.",
    }, 409)
  }

  const granted = await grantWalletAuthorization({
    ghUserId: auth.userId,
    piAppUid: mapping.piAppUid,
    source: "user_explicit",
  })
  if (!granted.ok) {
    const status = granted.error === "WALLET_AUTHORIZATION_UNAVAILABLE" ? 503 : 409
    return reply({ ok: false, error: granted.error || "GRANT_FAILED" }, status)
  }
  return reply({
    ok: true,
    authorizationId: granted.authorizationId,
    piAppUid: granted.piAppUid,
    status: "active",
    message: "Pi wallet authorization granted for App-to-User payouts to your linked identity.",
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
