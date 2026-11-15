import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitCode, durableRateLimitStatus } from "@/lib/server/security/control-plane"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { readDurableFeedPreferences, writeDurableFeedPreferences, type DurableFeedPreferences } from "@/lib/server/feed/preferences-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "no-store" }
const filters = new Set(["for-you", "following", "friends", "communities", "trending", "saved"])
const lanes = new Set(["worldwide", "city", "country"])
const intentions = new Set(["balanced", "friendship", "professional", "dating"])

function normalizeBody(value: unknown): DurableFeedPreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const normalizeIds = (input: unknown, max: number): string[] | null => {
    if (!Array.isArray(input) || input.length > max) return null
    const values: string[] = []
    for (const item of input) {
      if (typeof item !== "string" || !item.trim() || item.trim().length > 180) return null
      values.push(item.trim())
    }
    return [...new Set(values)].slice(-max)
  }
  const hiddenPostIds = normalizeIds(row.hiddenPostIds, 200)
  const notInterestedPostIds = normalizeIds(row.notInterestedPostIds, 200)
  if (!hiddenPostIds || !notInterestedPostIds || !Array.isArray(row.mutedTopics) || row.mutedTopics.length > 100) return null
  const mutedTopics: string[] = []
  for (const topic of row.mutedTopics) {
    if (typeof topic !== "string") return null
    const normalized = topic.trim().normalize("NFKC").toLocaleLowerCase()
    if (!/^[\p{L}\p{N}][\p{L}\p{N}\p{M}_]{1,31}$/u.test(normalized)) return null
    mutedTopics.push(normalized)
  }
  if (typeof row.filter !== "string" || !filters.has(row.filter)
    || typeof row.locationLane !== "string" || !lanes.has(row.locationLane)
    || typeof row.intentionBias !== "string" || !intentions.has(row.intentionBias)
    || typeof row.focusMode !== "boolean") return null
  return {
    hiddenPostIds,
    notInterestedPostIds,
    mutedTopics: [...new Set(mutedTopics)].slice(0, 100),
    filter: row.filter as DurableFeedPreferences["filter"],
    locationLane: row.locationLane as DurableFeedPreferences["locationLane"],
    intentionBias: row.intentionBias as DurableFeedPreferences["intentionBias"],
    focusMode: row.focusMode,
  }
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
  const rl = await checkDurableRateLimit(`feed-preferences-read:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
  if (!rl.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rl), retryAfterSec: rl.retryAfterSec }, { status: durableRateLimitStatus(rl), headers: { ...noStore, "Retry-After": String(rl.retryAfterSec) } })
  const result = await readDurableFeedPreferences(auth.userId)
  if (!result.ok) return NextResponse.json({ ok: false, durable: false, error: result.error }, { status: 503, headers: noStore })
  return NextResponse.json({ ok: true, durable: true, exists: result.exists, preferences: result.preferences }, { headers: noStore })
}

export async function PUT(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
  const rl = await checkDurableRateLimit(`feed-preferences-write:${auth.userId}`, 20, 60_000, { onUnavailable: "deny" })
  if (!rl.ok) return NextResponse.json({ ok: false, error: durableRateLimitCode(rl), retryAfterSec: rl.retryAfterSec }, { status: durableRateLimitStatus(rl), headers: { ...noStore, "Retry-After": String(rl.retryAfterSec) } })
  const parsed = await readBoundedJson(request, 24 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: noStore })
  const preferences = normalizeBody(parsed.value?.preferences)
  if (!preferences) return NextResponse.json({ ok: false, error: "INVALID_FEED_PREFERENCES" }, { status: 400, headers: noStore })
  const saved = await writeDurableFeedPreferences(auth.userId, preferences)
  if (!saved.ok) return NextResponse.json({ ok: false, durable: false, error: saved.error }, { status: 503, headers: noStore })
  return NextResponse.json({ ok: true, durable: true, preferences }, { headers: noStore })
}
