/**
 * POST /api/auth/webauthn/register/verify
 * Verify registration response and store public credential metadata.
 */

import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { requireRecentStepUp } from "@/lib/server/identity/step-up-store"
import { getWebAuthnRpConfig, isWebAuthnEnabled } from "@/lib/server/identity/webauthn-config"
import {
  consumeChallenge,
  saveCredential,
} from "@/lib/server/identity/webauthn-store"
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    if (!isWebAuthnEnabled()) {
      return NextResponse.json(
        { ok: false, error: "WEBAUTHN_DISABLED" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      )
    }

    pruneRateLimitBuckets()
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth?.sessionId || auth.source !== "gh_session") {
      return NextResponse.json(
        { ok: false, error: "SESSION_REQUIRED" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    }

    const step = await requireRecentStepUp(auth)
    if (step) {
      return NextResponse.json(
        { ok: false, error: step.code },
        { status: step.status, headers: { "Cache-Control": "no-store" } }
      )
    }

    const rl = checkRateLimit(`webauthn_reg_v:${auth.userId}`, 10, 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      )
    }

    const body = await request.json().catch(() => ({}))
    const response = body.response
    const label =
      typeof body.label === "string" && body.label.trim()
        ? body.label.trim().slice(0, 64)
        : "Passkey"

    if (!response) {
      return NextResponse.json(
        { ok: false, error: "RESPONSE_REQUIRED" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    let verifyRegistrationResponse: typeof import("@simplewebauthn/server").verifyRegistrationResponse
    try {
      ;({ verifyRegistrationResponse } = await import("@simplewebauthn/server"))
    } catch {
      return NextResponse.json(
        { ok: false, error: "WEBAUTHN_LIBRARY_UNAVAILABLE" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      )
    }

    // Challenge is embedded in clientDataJSON; SimpleWebAuthn verifies against expectedChallenge
    // We require the expected challenge from our store by decoding — library needs expectedChallenge string
    const clientDataJSON = response?.response?.clientDataJSON
    let challengeFromClient = ""
    try {
      const decoded = JSON.parse(
        Buffer.from(clientDataJSON, "base64url").toString("utf8")
      ) as { challenge?: string }
      challengeFromClient = String(decoded.challenge || "")
    } catch {
      /* */
    }

    const consumed = await consumeChallenge({
      ghUserId: auth.userId,
      purpose: "registration",
      challenge: challengeFromClient,
    })
    if (!consumed) {
      console.info("[webauthn] PASSKEY_AUTH_FAILED", { reason: "bad_challenge" })
      return NextResponse.json(
        { ok: false, error: "INVALID_CHALLENGE" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    const cfg = getWebAuthnRpConfig()
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: consumed.challenge,
      expectedOrigin: cfg.origin,
      expectedRPID: cfg.rpID,
      requireUserVerification: true,
    })

    if (!verification.verified || !verification.registrationInfo) {
      console.info("[webauthn] PASSKEY_AUTH_FAILED", { reason: "verify_failed" })
      return NextResponse.json(
        { ok: false, error: "VERIFICATION_FAILED" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    const info = verification.registrationInfo
    const credentialID = Buffer.from(info.credential.id).toString("base64url")
    const publicKey = Buffer.from(info.credential.publicKey).toString("base64url")

    await saveCredential({
      id: randomBytes(16).toString("hex"),
      ghUserId: auth.userId,
      credentialId: credentialID,
      publicKey,
      counter: info.credential.counter,
      transports: (response.response?.transports as string[]) || [],
      deviceType: info.credentialDeviceType || null,
      backedUp: Boolean(info.credentialBackedUp),
      label,
      createdAt: Date.now(),
      lastUsedAt: null,
      revokedAt: null,
    })

    console.info("[webauthn] PASSKEY_REGISTERED", {
      userId: auth.userId,
      sessionId: auth.sessionId.slice(0, 8),
    })

    return NextResponse.json(
      { ok: true, registered: true },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[webauthn/register/verify]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "WEBAUTHN_REGISTER_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
