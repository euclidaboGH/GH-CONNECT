/**
 * GET /api/social/people/discover?limit=30
 * Lists recent onboarded profiles for multi-user discovery (shared DB).
 * Actor from session only. No ranking scores, no economy.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit } from "@/lib/server/security/control-plane"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"

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
  if (visibility === "hidden") return null
  const locationVisible = privacy.showLocation !== false && privacy.locationPrivacy !== "hidden"
  const interestsVisible = privacy.showInterests !== false
  const bioVisible = privacy.showBio !== false

  const rawProfessional = payload.professional && typeof payload.professional === "object" && !Array.isArray(payload.professional)
    ? payload.professional as Record<string, unknown> : null
  const rawBusiness = payload.business && typeof payload.business === "object" && !Array.isArray(payload.business)
    ? payload.business as Record<string, unknown> : null
  const showProfession = privacy.showProfessional !== false && !(rawProfessional && rawProfessional.contactPreferences && typeof rawProfessional.contactPreferences === "object" && (rawProfessional.contactPreferences as Record<string, unknown>).showProfessionOnSocial === false)
  const professional = rawProfessional && showProfession
    ? {
      title: safeText(rawProfessional.title, 100), about: safeText(rawProfessional.about, 600),
      skills: safeList(rawProfessional.skills, 8, 48), services: safeList(rawProfessional.services, 6, 80),
      professionalInterests: interestsVisible ? safeList(rawProfessional.professionalInterests, 8, 64) : [],
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
      locationLabel: locationVisible ? safeText(rawProfessional.locationLabel, 90) : undefined,
      // Never project client-controlled verification flags or private contact preferences.
    } : null
  const business = rawBusiness ? {
    businessName: safeText(rawBusiness.businessName, 100), category: safeText(rawBusiness.category, 80),
    about: safeText(rawBusiness.about, 600), services: safeList(rawBusiness.services, 6, 80),
    locationLabel: locationVisible ? safeText(rawBusiness.locationLabel, 90) : undefined,
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
    skills: professional && interestsVisible ? safeList(rawProfessional?.skills, 8, 48) : [],
    locationVisible,
    interestsVisible,
    bioVisible,
  }
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const rl = await checkDurableRateLimit(`people-discover:${auth.userId}`, 30, 60_000, { onUnavailable: "deny" })
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, { status: rl.unavailable ? 503 : 429, headers: { "Cache-Control": "no-store", "Retry-After": String(rl.retryAfterSec) } })

  const url = new URL(request.url)
  const limit = Math.min(40, Math.max(1, Number(url.searchParams.get("limit") || 30) || 30))
  const query = safeText(url.searchParams.get("q"), 80)
  const beforeUpdatedAt = url.searchParams.get("beforeUpdatedAt")
  const beforeUserId = url.searchParams.get("beforeUserId")
  if (Boolean(beforeUpdatedAt) !== Boolean(beforeUserId) || (beforeUpdatedAt && (!Number.isFinite(Date.parse(beforeUpdatedAt)) || beforeUpdatedAt.length > 40)) || (beforeUserId && beforeUserId.length > 180)) {
    return NextResponse.json({ ok: false, error: "INVALID_CURSOR" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  if (!socialDbConfigured()) return NextResponse.json({ ok: false, durable: false, people: [], error: "SOCIAL_DB_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })

  // The database function applies blocks, follows, pending connections, prior passes,
  // profile visibility and discovery preferences before any profile data is returned.
  const result = await socialRpc("gh_discovery_candidates", {
    p_actor_id: auth.userId,
    p_limit: limit,
    p_before_updated_at: beforeUpdatedAt || null,
    p_before_user_id: beforeUserId || null,
    p_query: query || null,
  })
  if (!result.ok || !Array.isArray(result.data)) {
    return NextResponse.json({ ok: false, durable: false, people: [], error: "DISCOVERY_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }

  const rows = result.data as Array<Record<string, unknown>>
  const people = rows.flatMap((row) => {
    const publicIdentity = publicIdentityPayload(row.profile_payload, row)
    if (!publicIdentity) return []
    const { locationVisible, interestsVisible, bioVisible, ...identityPayload } = publicIdentity
    const photos = row.photos
    let avatar = ""
    if (Array.isArray(photos) && photos.length > 0) avatar = String(photos[0] || "")
    else if (typeof photos === "string") {
      try { const parsed = JSON.parse(photos); if (Array.isArray(parsed) && parsed[0]) avatar = String(parsed[0]) } catch { /* invalid legacy photo JSON */ }
    }
    return [{
      userId: String(row.gh_user_id || ""),
      displayName: safeText(row.display_name || row.username || "Member", 100) || "Member",
      username: safeText(row.username, 60) || "",
      bio: bioVisible ? safeText(row.bio, 600) || "" : "",
      avatarUrl: safeHttpsUrl(avatar) || "",
      city: locationVisible ? safeText(row.city, 80) || "" : "",
      country: locationVisible ? safeText(row.country, 80) || "" : "",
      interests: interestsVisible ? safeList(row.interests, 12, 64) : [],
      ...identityPayload,
      onboarded: row.onboarded === true,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    }]
  }).filter((person) => person.userId)
  const last = rows[rows.length - 1]
  const nextCursor = last && rows.length === limit && last.updated_at && last.gh_user_id
    ? { beforeUpdatedAt: String(last.updated_at), beforeUserId: String(last.gh_user_id) }
    : null
  return NextResponse.json({ ok: true, durable: true, people, nextCursor }, { headers: { "Cache-Control": "private, no-store" } })
}
