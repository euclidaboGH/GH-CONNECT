import { NextResponse } from "next/server"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify(args),
      cache: "no-store",
    })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

/**
 * Protected outbox drain endpoint for a scheduled job. A receipt means the event
 * has been durably consumed by this versioned integration dispatcher; it does
 * not claim that external payments or unrelated side effects occurred.
 */
export async function POST(request: Request) {
  if (process.env.GHC_DOMAIN_EVENTS_PAUSED === "1") return NextResponse.json({ ok: false, error: "DOMAIN_EVENTS_PAUSED" }, { status: 503 })
  const env = readGhcServerEnv()
  const secret = process.env.GHC_DOMAIN_EVENT_CRON_SECRET || process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ ok: false, error: "WORKER_SECRET_NOT_CONFIGURED" }, { status: 503 })
  const supplied = request.headers.get("x-cron-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || ""
  if (supplied.length !== secret.length || supplied !== secret) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return NextResponse.json({ ok: false, error: "DATABASE_UNAVAILABLE" }, { status: 503 })
  }

  const body = await request.json().catch(() => ({})) as { limit?: number; workerId?: string }
  const limit = Math.max(1, Math.min(100, Math.floor(Number(body.limit) || 50)))
  const workerId = String(body.workerId || `ghc-dispatch-${process.env.VERCEL_REGION || "server"}`).slice(0, 120)
  const expiredReservations = await rpc<number>("gh_marketplace_stock_expire", { p_limit: 100 })
  const publishedReviews = await rpc<number>("gh_marketplace_reviews_publish_matured", { p_limit: 100 })
  const claimed = await rpc<Array<Record<string, unknown>>>("gh_domain_event_claim", {
    p_worker: workerId,
    p_limit: limit,
  })
  if (!Array.isArray(claimed)) {
    return NextResponse.json({ ok: false, error: "OUTBOX_CLAIM_FAILED" }, { status: 503 })
  }

  let processed = 0
  let retried = 0
  const results: Array<{ eventId: string; eventType: string; status: string }> = []
  for (const event of claimed) {
    const eventId = String(event.id || "")
    const eventType = String(event.eventType || "")
    if (!eventId || !eventType) continue
    // Only known, versioned contracts are acknowledged. Unknown events are retried
    // rather than silently discarded, so newly introduced producers fail visibly.
    const supported = new Set([
      "curation.feedback_recorded",
      "marketplace.order_transitioned",
      "reward.claimed",
      "ledger.entry_recorded",
      "reward.held",
      "reward.reversed",
      "reward.appeal_submitted",
      "reward.appeal_reviewed",
      "marketplace.refund_completed",
      "ranking.impression",
      "progression.xp_awarded",
      "growth.referral_created",
      "growth.referral_qualified",
      "reputation.appeal_submitted",
      "reputation.appeal_reviewed",
      "reputation.review_verified",
      "marketplace.review_submitted",
      "marketplace.listing_reported",
      "marketplace.listing_moderated",
      "reputation.signal_recorded",
    ])
    if (!supported.has(eventType)) {
      await rpc("gh_domain_event_retry", {
        p_event_id: eventId,
        p_worker: workerId,
        p_error: `Unsupported event contract: ${eventType}`,
      })
      retried += 1
      results.push({ eventId, eventType, status: "retry_unsupported" })
      continue
    }
    const ack = await rpc<Record<string, unknown>>("gh_domain_event_ack", {
      p_event_id: eventId,
      p_worker: workerId,
      p_consumer: "ghc-domain-dispatcher-v1",
      p_result: { accepted: true, contract: eventType, version: Number(event.schemaVersion) || 1 },
    })
    if (ack && ack.ok === true) {
      processed += 1
      results.push({ eventId, eventType, status: "processed" })
    } else {
      await rpc("gh_domain_event_retry", {
        p_event_id: eventId,
        p_worker: workerId,
        p_error: "Acknowledgement failed",
      })
      retried += 1
      results.push({ eventId, eventType, status: "retry_ack_failed" })
    }
  }

  return NextResponse.json({ ok: true, expiredReservations: Number(expiredReservations) || 0, publishedReviews: Number(publishedReviews) || 0, claimed: claimed.length, processed, retried, results }, {
    headers: { "Cache-Control": "no-store" },
  })
}
