/**
 * GET/PATCH /api/profile/me
 * Server-authoritative social profile for the authenticated GH user.
 * Never trusts client userId for ownership. No balances/membership in this resource.
 */

import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  getServerProfile,
  upsertServerProfile,
  serverProfileToClientPartial,
  isProfileStoreDurable,
} from "@/lib/server/identity/profile-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }

    const limit = checkRateLimit(`profile-read:${auth.userId}`, 120, 60_000)
    if (!limit.ok) {
      return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(limit.retryAfterSec) } })
    }
    const rec = await getServerProfile(auth.userId)
    return NextResponse.json(
      {
        ok: true,
        durable: isProfileStoreDurable(),
        profile: rec ? serverProfileToClientPartial(rec) : null,
        exists: Boolean(rec),
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[profile/me GET]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "PROFILE_LOAD_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }

    const limit = checkRateLimit(`profile-write:${auth.userId}`, 30, 60_000)
    if (!limit.ok) {
      return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(limit.retryAfterSec) } })
    }
    const contentLength = Number(request.headers.get("content-length") || 0)
    if (Number.isFinite(contentLength) && contentLength > 65_536) {
      return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413, headers: { "Cache-Control": "no-store" } })
    }
    const rawBody = await request.text()
    if (rawBody.length > 65_536) {
      return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413, headers: { "Cache-Control": "no-store" } })
    }
    let body: unknown
    try { body = JSON.parse(rawBody) } catch { body = null }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_BODY" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    // Ignore any client-supplied identity / financial fields (session auth is sole owner)
    const input = { ...(body as Record<string, unknown>) }
    delete input.id
    delete input.userId
    delete input.ghUserId
    delete input.gh_user_id
    delete input.piId
    delete input.piAppUid
    delete input.ownerId
    delete input.balance
    delete input.membership
    delete input.tier
    // Lifecycle state is changed only by /api/auth/onboarding-complete.
    delete input.onboarded

    const saved = await upsertServerProfile(auth.userId, input)
    if (!saved) {
      return NextResponse.json(
        {
          ok: false,
          error: "PROFILE_PERSIST_FAILED",
          detail: "Server profile store unavailable or write failed",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        durable: isProfileStoreDurable(),
        profile: serverProfileToClientPartial(saved),
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "[profile/me PATCH]",
      err instanceof Error ? err.message : "unknown"
    )
    return NextResponse.json(
      { ok: false, error: "PROFILE_SAVE_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
