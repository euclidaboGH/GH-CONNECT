/**
 * POST /api/auth/webauthn/authenticate/verify
 * Verify assertion and establish server-side step-up (auth_method=webauthn).
 */

import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { createStepUp } from "@/lib/server/identity/step-up-store"
import { getWebAuthnRpConfig, isWebAuthnEnabled } from "@/lib/server/identity/webauthn-config"
import {
  consumeChallenge,
  getCredentialByCredentialId,
  updateCredentialCounter,
} from "@/lib/server/identity/webauthn-store"
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/server/economy/rate-limit"
import { STEP_UP_TTL_MS } from "@/lib/server/identity/step-up-store"

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

    const rl = checkRateLimit(`webauthn_auth_v:${auth.userId}`, 20, 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      )
    }

    const body = await request.json().catch(() => ({}))
    const response = body.response
    if (!response) {
      return NextResponse.json(
        { ok: false, error: "RESPONSE_REQUIRED" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    let verifyAuthenticationResponse: typeof import("@simplewebauthn/server").verifyAuthenticationResponse
    try {
      ;({ verifyAuthenticationResponse } = await import("@simplewebauthn/server"))
    } catch {
      return NextResponse.json(
        { ok: false, error: "WEBAUTHN_LIBRARY_UNAVAILABLE" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      )
    }

    let challengeFromClient = ""
    try {
      const decoded = JSON.parse(
        Buffer.from(response.response.clientDataJSON, "base64url").toString("utf8")
      ) as { challenge?: string }
      challengeFromClient = String(decoded.challenge || "")
    } catch {
      /* */
    }

    const consumed = await consumeChallenge({
      ghUserId: auth.userId,
      purpose: "authentication",
      challenge: challengeFromClient,
    })
    if (!consumed) {
      console.info("[webauthn] PASSKEY_AUTH_FAILED", { reason: "bad_challenge" })
      return NextResponse.json(
        { ok: false, error: "INVALID_CHALLENGE" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    // Bind challenge to current session when present
    if (consumed.sessionId && consumed.sessionId !== auth.sessionId) {
      console.info("[webauthn] PASSKEY_AUTH_FAILED", { reason: "session_mismatch" })
      return NextResponse.json(
        { ok: false, error: "SESSION_MISMATCH" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    }

    const credentialId = String(response.id || "")
    const stored = await getCredentialByCredentialId(credentialId)
    if (!stored || stored.ghUserId !== auth.userId) {
      console.info("[webauthn] PASSKEY_AUTH_FAILED", { reason: "cred_mismatch" })
      return NextResponse.json(
        { ok: false, error: "CREDENTIAL_NOT_FOUND" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    const cfg = getWebAuthnRpConfig()
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: consumed.challenge,
      expectedOrigin: cfg.origin,
      expectedRPID: cfg.rpID,
      credential: {
        id: stored.credentialId,
        publicKey: Buffer.from(stored.publicKey, "base64url"),
        counter: stored.counter,
        transports: stored.transports as AuthenticatorTransport[],
      },
      requireUserVerification: true,
    })

    if (!verification.verified) {
      console.info("[webauthn] PASSKEY_AUTH_FAILED", { reason: "verify_failed" })
      return NextResponse.json(
        { ok: false, error: "VERIFICATION_FAILED" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    const newCounter = verification.authenticationInfo.newCounter
    await updateCredentialCounter(stored.credentialId, newCounter)

    // Establish server step-up bound to current GH session
    const step = await createStepUp({
      ghUserId: auth.userId,
      sessionId: auth.sessionId,
      authMethod: "webauthn",
    })

    console.info("[webauthn] PASSKEY_AUTHENTICATED", {
      userId: auth.userId,
      sessionId: auth.sessionId.slice(0, 8),
    })

    return NextResponse.json(
      {
        ok: true,
        stepUp: {
          expiresAt: step.expiresAt,
          ttlMs: STEP_UP_TTL_MS,
          authMethod: "webauthn",
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[webauthn/authenticate/verify]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "WEBAUTHN_AUTH_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
