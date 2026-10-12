import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { enqueueDomainEvent } from "@/lib/server/domain-events/outbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const REASONS = new Set(["personalization", "following", "friends", "interest", "contribution", "freshness", "diversity", "trending", "unknown"])
const RANKING_VERSIONS = new Set(["for-you-v1", "for-you-v2-diversity"])

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const rl = checkRateLimit(`ranking-impressions:${auth.userId}`, 30, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, { status: 429 })
  const body = await request.json().catch(() => ({})) as { impressions?: unknown }
  if (!Array.isArray(body.impressions) || body.impressions.length < 1 || body.impressions.length > 20) {
    return NextResponse.json({ ok: false, error: "INVALID_IMPRESSIONS" }, { status: 400 })
  }
  const impressions = body.impressions.map((raw, index) => {
    const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}
    const postId = String(row.postId || "").trim()
    const reason = String(row.reasonCategory || "unknown")
    const dwellMs = row.dwellMs == null ? null : Number(row.dwellMs)
    const rankingVersion = String(row.rankingVersion || "for-you-v2-diversity")
    return {
      viewer_id: auth.userId,
      post_id: postId,
      rank_position: Number(row.rankPosition) || index + 1,
      ranking_version: RANKING_VERSIONS.has(rankingVersion) ? rankingVersion : "for-you-v2-diversity",
      reason_category: REASONS.has(reason) ? reason : "unknown",
      dwell_ms: dwellMs != null && Number.isInteger(dwellMs) && dwellMs >= 0 && dwellMs <= 3600000 ? dwellMs : null,
    }
  })
  if (impressions.some((i) => !i.post_id || i.post_id.length > 128 || !Number.isInteger(i.rank_position) || i.rank_position < 1 || i.rank_position > 500)) {
    return NextResponse.json({ ok: false, error: "INVALID_IMPRESSION_ROW" }, { status: 400 })
  }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return NextResponse.json({ ok: false, error: "DATABASE_UNAVAILABLE" }, { status: 503 })
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_ranking_impressions`, {
      method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=minimal", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify(impressions), cache: "no-store",
    })
    if (!response.ok) return NextResponse.json({ ok: false, error: "IMPRESSION_WRITE_FAILED" }, { status: 503 })
    // Aggregate-level idempotency bounds retries; raw telemetry is never used to mint value.
    void enqueueDomainEvent({
      eventType: "ranking.impression",
      idempotencyKey: `ranking.impression:${auth.userId}:${Date.now()}:${impressions.length}`,
      aggregateType: "viewer",
      aggregateId: auth.userId,
      actorId: auth.userId,
      payload: { count: impressions.length, rankingVersion: "for-you-v2-diversity" },
    })
    return NextResponse.json({ ok: true, accepted: impressions.length }, { status: 202 })
  } catch { return NextResponse.json({ ok: false, error: "IMPRESSION_WRITE_FAILED" }, { status: 503 }) }
}
