/**
 * POST /api/auth/webauthn/authenticate/options
 * Generate authentication options for step-up / reauth.
 * Requires existing GH session (passkeys are not primary Pi identity bootstrap).
 */

import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
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
    if (!auth?.sessionId || auth.source !== "gh_session") {
      return NextResponse.json(
        { ok: false, error: "SESSION_REQUIRED" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    }

    const rl = checkRateLimit(`webauthn_auth:${auth.userId}`, 20, 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      )
    }

    const creds = await listCredentialsForUser(auth.userId)
    if (creds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "NO_PASSKEYS" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    let generateAuthenticationOptions: typeof import("@simplewebauthn/server").generateAuthenticationOptions
    try {
      ;({ generateAuthenticationOptions } = await import("@simplewebauthn/server"))
    } catch {
      return NextResponse.json(
        { ok: false, error: "WEBAUTHN_LIBRARY_UNAVAILABLE" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      )
    }

    const cfg = getWebAuthnRpConfig()
    const options = await generateAuthenticationOptions({
      rpID: cfg.rpID,
      userVerification: "required",
      allowCredentials: creds.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransport[],
      })),
    })

    createChallenge({
      ghUserId: auth.userId,
      sessionId: auth.sessionId,
      purpose: "authentication",
      challenge: options.challenge,
    })

    return NextResponse.json(
      { ok: true, options },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[webauthn/authenticate/options]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "WEBAUTHN_OPTIONS_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
