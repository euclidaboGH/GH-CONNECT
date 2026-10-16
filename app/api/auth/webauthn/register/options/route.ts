/**
 * POST /api/auth/webauthn/register/options
 * Generate registration options for an authenticated GH session user.
 * Requires GH session + recent step-up (prevent silent attacker passkey add).
 */

import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { requireRecentStepUp } from "@/lib/server/identity/step-up-store"
import { getWebAuthnRpConfig, isWebAuthnEnabled } from "@/lib/server/identity/webauthn-config"
import {
  createChallenge,
  listCredentialsForUser,
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
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }
    if (auth.source !== "gh_session" || !auth.sessionId) {
      return NextResponse.json(
        { ok: false, error: "SESSION_REQUIRED" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    }

    const step = await requireRecentStepUp(auth)
    if (step) {
      return NextResponse.json(
        { ok: false, error: step.code, detail: step.message },
        { status: step.status, headers: { "Cache-Control": "no-store" } }
      )
    }

    const rl = checkRateLimit(`webauthn_reg:${auth.userId}`, 10, 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      )
    }

    const cfg = getWebAuthnRpConfig()
    // Dynamic import — package may not be installed in some environments
    let generateRegistrationOptions: typeof import("@simplewebauthn/server").generateRegistrationOptions
    try {
      ;({ generateRegistrationOptions } = await import("@simplewebauthn/server"))
    } catch {
      return NextResponse.json(
        { ok: false, error: "WEBAUTHN_LIBRARY_UNAVAILABLE" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      )
    }

    const existing = await listCredentialsForUser(auth.userId)
    const options = await generateRegistrationOptions({
      rpName: cfg.rpName,
      rpID: cfg.rpID,
      userName: auth.userId,
      userDisplayName: auth.username || auth.userId,
      userID: new TextEncoder().encode(auth.userId),
      attestationType: "none",
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransport[],
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
        authenticatorAttachment: "platform",
      },
    })

    createChallenge({
      ghUserId: auth.userId,
      sessionId: auth.sessionId,
      purpose: "registration",
      challenge: options.challenge,
    })

    return NextResponse.json(
      { ok: true, options },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[webauthn/register/options]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "WEBAUTHN_OPTIONS_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
