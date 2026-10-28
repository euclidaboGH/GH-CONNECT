/**
 * POST /api/auth/pi
 *
 * Official Pi identity bridge + GH server session issuance (Phase 2B):
 * 1) Client sends accessToken from Pi.authenticate()
 * 2) Server verifies with GET /v2/me
 * 3) Durable identity mapping
 * 4) Issue GH CONNECT server session (HttpOnly cookie)
 * 5) Return non-secret identity + onboarding flags
 *
 * Never trust client-supplied uid or ghUserId.
 * Never store Pi access tokens in session table.
 */

import { NextResponse } from "next/server"
import { verifyPiAccessToken } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, appendSecurityEvent, requestCorrelationId } from "@/lib/server/security/control-plane"
import { createHash } from "node:crypto"
import {
  findOrCreateFromVerifiedPi,
  touchLastSeen,
  isPiIdentityDurable,
} from "@/lib/server/identity/pi-identity-store"
import { ensurePublicIdentity } from "@/lib/server/economy/public-id"
import { recordPioneerActivity } from "@/lib/server/engagement/pioneer-activity"
import {
  createSession,
  buildSessionCookieHeader,
  isSessionStoreDurable,
} from "@/lib/server/identity/session-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const forwardedParts = (request.headers.get("x-forwarded-for") || "").split(",").map((part) => part.trim()).filter(Boolean)
    const forwarded = forwardedParts.length ? forwardedParts[forwardedParts.length - 1] : ""
    const clientIp = request.headers.get("x-real-ip")?.trim() || forwarded || "unknown"
    const correlationId = requestCorrelationId(request)
    const rate = await checkDurableRateLimit(`pi-auth:${createHash("sha256").update(clientIp).digest("hex").slice(0, 24)}`, 12, 60_000, { onUnavailable: "deny" })
    if (!rate.ok) {
      void appendSecurityEvent({ eventType: "auth.pi.rate_limited", outcome: "blocked", reasonCode: "RATE_LIMITED", correlationId })
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED", retryAfterSec: rate.retryAfterSec },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(rate.retryAfterSec) } }
      )
    }
    const contentLength = Number(request.headers.get("content-length") || 0)
    if (Number.isFinite(contentLength) && contentLength > 16_384) {
      return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413, headers: { "Cache-Control": "no-store" } })
    }
    // Enforce the cap on the actual body too; content-length can be absent on
    // streamed/chunked requests. Do not parse an unbounded JSON body first.
    const rawBody = await request.text()
    if (Buffer.byteLength(rawBody, "utf8") > 16_384) {
      return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413, headers: { "Cache-Control": "no-store" } })
    }
    let body: Record<string, unknown> = {}
    try {
      const parsed: unknown = JSON.parse(rawBody)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    const accessToken =
      typeof body.accessToken === "string" ? body.accessToken.trim() : ""

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: "accessToken required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }
    if (accessToken.length > 8_192 || /[\u0000-\u001f\u007f]/.test(accessToken)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_ACCESS_TOKEN_FORMAT" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    const piUser = await verifyPiAccessToken(accessToken)
    if (!piUser?.uid) {
      void appendSecurityEvent({ eventType: "auth.pi.rejected", outcome: "blocked", reasonCode: "INVALID_PI_TOKEN", correlationId })
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_PI_TOKEN",
          detail:
            "Pi /me rejected the access token. Re-authenticate in Pi Browser.",
        },
        { status: 401 }
      )
    }

    const prod =
      process.env.NODE_ENV === "production" ||
      process.env.VERCEL_ENV === "production" ||
      process.env.GHC_ENV === "production"
    // Production must not issue identity/session from process memory — returning
    // users would look new after cold starts. Fail closed with a clear error.
    if (prod && (!isPiIdentityDurable() || !isSessionStoreDurable())) {
      console.error("[auth/pi] IDENTITY_STORE_UNAVAILABLE", {
        identityDurable: isPiIdentityDurable(),
        sessionDurable: isSessionStoreDurable(),
      })
      return NextResponse.json(
        {
          ok: false,
          error: "IDENTITY_STORE_UNAVAILABLE",
          detail:
            "Server identity storage is not configured. Operators must set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and apply gh_pi_identities / gh_sessions migrations.",
        },
        { status: 503 }
      )
    }

    let record
    let isNew
    try {
      const result = await findOrCreateFromVerifiedPi({
        piAppUid: piUser.uid,
        piUsername: piUser.username ?? null,
      })
      record = result.record
      isNew = result.isNew
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown"
      if (msg === "IDENTITY_DURABILITY_UNAVAILABLE") {
        return NextResponse.json(
          {
            ok: false,
            error: "IDENTITY_STORE_UNAVAILABLE",
            detail:
              "Durable identity write failed. Check Supabase connectivity and migrations.",
          },
          { status: 503 }
        )
      }
      throw err
    }

    void touchLastSeen(record.ghUserId)
    try {
      await ensurePublicIdentity({
        userId: record.ghUserId,
        displayName: record.piUsername,
      })
    } catch {
      /* public id best-effort — referral still has derived GH- id */
    }

    const isReturning = !isNew && record.onboardingCompleted === true
    const needsOnboarding = record.onboardingCompleted !== true
    // Existing mapping row (may still need onboarding form if onboardingCompleted was never stamped)
    const identityExisted = !isNew

    // Issue GH server session only after verified Pi identity
    const ua = request.headers.get("user-agent")
    let issued
    try {
      issued = await createSession({
        ghUserId: record.ghUserId,
        userAgent: ua,
      })
    } catch (sessErr) {
      const msg = sessErr instanceof Error ? sessErr.message : "unknown"
      if (msg.includes("DURABILITY") || (prod && !isSessionStoreDurable())) {
        return NextResponse.json(
          {
            ok: false,
            error: "SESSION_STORE_UNAVAILABLE",
            detail: "Durable session storage failed.",
          },
          { status: 503 }
        )
      }
      throw sessErr
    }

    const identityDurable = isPiIdentityDurable()
    const sessionDurable = isSessionStoreDurable()
    // durabilityWarning only for non-production degraded mode (should not appear in prod after fail-closed)
    const durabilityWarning =
      !prod && (!identityDurable || !sessionDurable)
        ? "IDENTITY_OR_SESSION_NOT_DURABLE: configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and apply gh_pi_identities / gh_sessions migrations."
        : undefined

    const res = NextResponse.json(
      {
        ok: true,
        verified: true,
        isNew,
        isReturning,
        identityExisted,
        needsOnboarding,
        durable: identityDurable,
        sessionDurable,
        ...(durabilityWarning ? { durabilityWarning } : {}),
        session: {
          id: issued.record.id,
          expiresAt: issued.record.expiresAt,
          absoluteExpiresAt: issued.record.absoluteExpiresAt,
        },
        identity: {
          ghUserId: record.ghUserId,
          piAppUid: record.piAppUid,
          piUsername: record.piUsername,
          onboardingCompleted: record.onboardingCompleted,
          verifiedAt: record.verifiedAt,
          lastSeenAt: record.lastSeenAt,
          serverVerified: true,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    )

    res.headers.append(
      "Set-Cookie",
      buildSessionCookieHeader(issued.rawToken)
    )

    void appendSecurityEvent({ eventType: "auth.pi.success", outcome: "allowed", actorUserId: record.ghUserId, correlationId })
    void recordPioneerActivity({
      userId: record.ghUserId,
      kind: isReturning ? "session_verified" : "session_verified",
      metadata: { isNew, isReturning },
    })
    return res
  } catch (err) {
    console.error(
      "[auth/pi] bridge failed",
      err instanceof Error ? err.message : "unknown"
    )
    const msg = err instanceof Error ? err.message : ""
    if (msg === "IDENTITY_DURABILITY_UNAVAILABLE") {
      return NextResponse.json(
        {
          ok: false,
          error: "IDENTITY_STORE_UNAVAILABLE",
          detail:
            "Durable identity storage is unavailable on this deployment.",
        },
        { status: 503 }
      )
    }
    return NextResponse.json(
      {
        ok: false,
        error: "AUTH_BRIDGE_FAILED",
      },
      { status: 500 }
    )
  }
}
