import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { getServerProfile, upsertServerProfile, isProfileStoreDurable } from "@/lib/server/identity/profile-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "no-store" }
const categories = new Set([
  "messages", "matches", "connections", "comments", "mentions", "communities",
  "stories", "marketplace", "rewards", "wallet", "premium", "profile_views",
  "product_updates", "system",
])
type AccountPrefs = Record<string, { inApp: boolean }>
function validPreferences(value: unknown): value is AccountPrefs {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const entries = Object.entries(value as Record<string, unknown>)
  if (!entries.length || entries.length > categories.size) return false
  return entries.every(([category, prefs]) => categories.has(category)
    && Boolean(prefs) && typeof prefs === "object" && !Array.isArray(prefs)
    && typeof (prefs as Record<string, unknown>).inApp === "boolean"
    && Object.keys(prefs as object).every((key) => key === "inApp"))
}

export async function GET(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
    const rl = checkRateLimit(`notification-preferences-read:${auth.userId}`, 60, 60_000)
    if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: noStore })
    const profile = await getServerProfile(auth.userId)
    const raw = profile?.profilePayload?.notificationPreferences
    const preferences = validPreferences(raw) ? raw : {}
    return NextResponse.json({ ok: true, durable: isProfileStoreDurable(), preferences }, { headers: noStore })
  } catch (error) {
    console.error("[notification-preferences GET]", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ ok: false, error: "PREFERENCE_READ_FAILED" }, { status: 503, headers: noStore })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await resolveAuthenticatedUser(request.headers)
    if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
    const rl = checkRateLimit(`notification-preferences-write:${auth.userId}`, 30, 60_000)
    if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: noStore })
    const parsed = await readBoundedJson(request, 8 * 1024)
    if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: noStore })
    const input = (parsed.value as Record<string, unknown> | null)?.preferences
    if (!validPreferences(input)) return NextResponse.json({ ok: false, error: "INVALID_PREFERENCES" }, { status: 400, headers: noStore })
    const existing = await getServerProfile(auth.userId)
    const payload = { ...(existing?.profilePayload || {}), notificationPreferences: input }
    const saved = await upsertServerProfile(auth.userId, { profilePayload: payload })
    if (!saved) return NextResponse.json({ ok: false, error: "PREFERENCE_STORE_UNAVAILABLE" }, { status: 503, headers: noStore })
    const canonical = saved.profilePayload.notificationPreferences
    if (!validPreferences(canonical)) return NextResponse.json({ ok: false, error: "PREFERENCE_SAVE_UNCONFIRMED" }, { status: 503, headers: noStore })
    return NextResponse.json({ ok: true, durable: isProfileStoreDurable(), preferences: canonical }, { headers: noStore })
  } catch (error) {
    console.error("[notification-preferences PATCH]", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ ok: false, error: "PREFERENCE_SAVE_FAILED" }, { status: 503, headers: noStore })
  }
}
