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

function safeText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
  return text || undefined
}

function safeList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === "string")
    .map((item) => safeText(item, maxLength)).filter((item): item is string => Boolean(item)))].slice(0, maxItems)
}

function safeHttpsUrl(value: unknown): string | undefined {
  const raw = safeText(value, 2048)
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:" || url.username || url.password) return undefined
    return url.toString()
  } catch { return undefined }
}

function publicIdentityPayload(value: unknown, row: Record<string, unknown>) {
  const payload = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const privacy = payload.privacySettings && typeof payload.privacySettings === "object"
    ? payload.privacySettings as Record<string, unknown>
    : payload.privacy && typeof payload.privacy === "object" ? payload.privacy as Record<string, unknown> : {}
  const visibility = privacy.profileVisibility
  if (visibility === "hidden" || visibility === "matches-only") return null

  const rawProfessional = payload.professional && typeof payload.professional === "object" && !Array.isArray(payload.professional)
    ? payload.professional as Record<string, unknown> : null
  const rawBusiness = payload.business && typeof payload.business === "object" && !Array.isArray(payload.business)
    ? payload.business as Record<string, unknown> : null
  const showProfession = !(rawProfessional && rawProfessional.contactPreferences && typeof rawProfessional.contactPreferences === "object" && (rawProfessional.contactPreferences as Record<string, unknown>).showProfessionOnSocial === false)
  const professional = rawProfessional && showProfession
    ? {
      title: safeText(rawProfessional.title, 100), about: safeText(rawProfessional.about, 600),
      skills: safeList(rawProfessional.skills, 8, 48), services: safeList(rawProfessional.services, 6, 80),
      professionalInterests: privacy.showInterests === false ? [] : safeList(rawProfessional.professionalInterests, 8, 64),
      experience: (Array.isArray(rawProfessional.experience) ? rawProfessional.experience : []).slice(0, 3).flatMap((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return []
        const item = entry as Record<string, unknown>
        const role = safeText(item.role, 90)
        return role ? [{ role, organization: safeText(item.organization, 90), from: safeText(item.from, 24), to: safeText(item.to, 24), summary: safeText(item.summary, 180) }] : []
      }),
      portfolio: (Array.isArray(rawProfessional.portfolio) ? rawProfessional.portfolio : []).slice(0, 4).flatMap((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return []
        const item = entry as Record<string, unknown>
        const title = safeText(item.title, 90)
        if (!title) return []
        return [{ title, description: safeText(item.description, 180), url: safeHttpsUrl(item.url), mediaUrl: safeHttpsUrl(item.mediaUrl) }]
      }),
      locationLabel: privacy.showLocation === false ? undefined : safeText(rawProfessional.locationLabel, 90),
      // Never project client-controlled verification flags or private contact preferences.
    } : null
  const business = rawBusiness ? {
    businessName: safeText(rawBusiness.businessName, 100), category: safeText(rawBusiness.category, 80),
    about: safeText(rawBusiness.about, 600), services: safeList(rawBusiness.services, 6, 80),
    locationLabel: privacy.showLocation === false ? undefined : safeText(rawBusiness.locationLabel, 90),
    hours: safeText(rawBusiness.hours, 90),
    // Verification is not projected from profile payload; it requires a trusted verification service.
  } : null
  const profileMode = payload.profileMode === "business" && business ? "business"
    : payload.profileMode === "professional" && professional ? "professional" : "social"
  return {
    profileMode,
    profession: showProfession ? safeText(professional?.title || row.profession, 100) : undefined,
    professional: professional || undefined,
    business: business || undefined,
    skills: professional ? safeList(rawProfessional?.skills, 8, 48) : [],
  }
}

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
      `&select=gh_user_id,display_name,username,bio,photos,city,country,profession,skills,interests,profile_payload,updated_at,onboarded` +
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
    const people = (Array.isArray(rows) ? rows : []).flatMap((row) => {
      const publicIdentity = publicIdentityPayload(row.profile_payload, row)
      if (!publicIdentity) return []
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
      return [{
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
        ...publicIdentity,
        onboarded: row.onboarded === true,
      }]
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
