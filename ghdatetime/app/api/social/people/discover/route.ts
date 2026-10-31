/**
 * GET /api/social/people/discover?limit=30
 * Lists recent onboarded profiles for multi-user discovery (shared DB).
 * Actor from session only. No ranking scores, no economy.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const rl = checkRateLimit(`people-discover:${auth.userId}`, 30, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }

  const limit = Math.min(
    40,
    Math.max(1, Number(new URL(request.url).searchParams.get("limit") || 30) || 30)
  )

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return NextResponse.json({
      ok: true,
      durable: false,
      people: [],
      message: "SOCIAL_DB_UNAVAILABLE",
    })
  }

  try {
    const base = env.supabaseUrl.replace(/\/$/, "")
    // Prefer onboarded profiles; exclude actor
    // All registered profiles (not only onboarded=true) so new KYC'd users appear
    const url =
      `${base}/rest/v1/gh_user_profiles` +
      `?gh_user_id=neq.${encodeURIComponent(auth.userId)}` +
      `&select=gh_user_id,display_name,username,bio,photos,city,country,interests,updated_at,onboarded` +
      `&order=updated_at.desc` +
      `&limit=${limit}`

    const res = await fetch(url, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return NextResponse.json(
        {
          ok: false,
          durable: false,
          people: [],
          error: "QUERY_FAILED",
          detail: text.slice(0, 160),
        },
        { status: 503 }
      )
    }

    const rows = (await res.json().catch(() => [])) as Array<Record<string, unknown>>
    const people = (Array.isArray(rows) ? rows : []).map((row) => {
      const photos = row.photos
      let avatar = ""
      if (Array.isArray(photos) && photos.length > 0) avatar = String(photos[0] || "")
      else if (typeof photos === "string") {
        try {
          const parsed = JSON.parse(photos)
          if (Array.isArray(parsed) && parsed[0]) avatar = String(parsed[0])
        } catch {
          /* */
        }
      }
      return {
        userId: String(row.gh_user_id || ""),
        displayName: String(row.display_name || row.username || "Member"),
        username: row.username ? String(row.username) : "",
        bio: row.bio ? String(row.bio) : "",
        avatarUrl: avatar,
        city: row.city ? String(row.city) : "",
        country: row.country ? String(row.country) : "",
        interests: Array.isArray(row.interests)
          ? (row.interests as unknown[]).map(String).slice(0, 12)
          : [],
        onboarded: row.onboarded === true,
      }
    }).filter((p) => p.userId)

    return NextResponse.json({
      ok: true,
      durable: true,
      people,
    })
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        durable: false,
        people: [],
        error: e instanceof Error ? e.message : "discover_failed",
      },
      { status: 500 }
    )
  }
}
