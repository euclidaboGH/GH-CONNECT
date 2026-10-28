import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { nonDurableWriteResponse } from "@/lib/server/production-guard"
import { emitSocialNotification } from "@/lib/server/social/notifications"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/matching/signal
 * Body: { targetUserId: string, signal: "like" | "pass" | "superlike" }
 * Actor is always the session user. Never trusts client fromUserId.
 */
export async function POST(req: Request) {
  try {
    const auth = await resolveAuthenticatedUser(req.headers)
    if (!auth?.userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
    }

    const rl = checkRateLimit(`match-signal:${auth.userId}`, 60, 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec },
        { status: 429 }
      )
    }

    const parsedBody = await readBoundedJson(req, 4 * 1024)
    if (!parsedBody.ok) {
      return NextResponse.json(
        { ok: false, error: parsedBody.error },
        { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400 },
      )
    }
    const body = parsedBody.value
    if (typeof body.targetUserId !== "string" || typeof body.signal !== "string") {
      return NextResponse.json({ ok: false, error: "INVALID_SIGNAL" }, { status: 400 })
    }
    const targetUserId = body.targetUserId.trim()
    const signal = body.signal.trim().toLowerCase()
    if (!targetUserId || targetUserId === auth.userId) {
      return NextResponse.json({ ok: false, error: "INVALID_TARGET" }, { status: 400 })
    }
    if (!["like", "pass", "superlike"].includes(signal)) {
      return NextResponse.json({ ok: false, error: "INVALID_SIGNAL" }, { status: 400 })
    }

    const env = readGhcServerEnv()
    if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
      const nd = nonDurableWriteResponse("Match signal")
      return NextResponse.json(nd.body, { status: nd.status })
    }

    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_match_signal_upsert`,
      {
        method: "POST",
        headers: {
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_from_user_id: auth.userId,
          p_to_user_id: targetUserId,
          p_signal: signal,
        }),
      }
    )

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      const nd = nonDurableWriteResponse("Match signal", {
        extra: { message: "RPC_UNAVAILABLE", detail: text.slice(0, 200) },
      })
      return NextResponse.json(nd.body, { status: nd.status })
    }

    const row = await res.json().catch(() => null)

    // Detect mutual interest (they liked us + we like them)
    let mutual = false
    if (signal === "like" || signal === "superlike") {
      const base = env.supabaseUrl.replace(/\/$/, "")
      const q =
        `${base}/rest/v1/ghc_match_signals` +
        `?from_user_id=eq.${encodeURIComponent(targetUserId)}` +
        `&to_user_id=eq.${encodeURIComponent(auth.userId)}` +
        `&signal=in.(like,superlike)&select=id&limit=1`
      const peer = await fetch(q, {
        headers: {
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
      })
      if (peer.ok) {
        const rows = (await peer.json().catch(() => [])) as unknown[]
        mutual = Array.isArray(rows) && rows.length > 0
      }
    }

    // Phase 8: notify peer of interest / mutual match
    if (signal === "like" || signal === "superlike") {
      if (mutual) {
        void emitSocialNotification({
          recipientUserId: targetUserId,
          actorUserId: auth.userId,
          type: "follow",
          entityType: "user",
          entityId: auth.userId,
          title: "It's a Match",
          body: "You both expressed interest on GreenHaven",
          dedupeKey: `match_mutual:${[auth.userId, targetUserId].sort().join(":")}`,
          metadata: { kind: "match_mutual" },
        })
      } else {
        void emitSocialNotification({
          recipientUserId: targetUserId,
          actorUserId: auth.userId,
          type: "follow",
          entityType: "user",
          entityId: auth.userId,
          title: "New interest",
          body: "Someone liked your profile",
          dedupeKey: `match_like:${auth.userId}:${targetUserId}`,
          metadata: { kind: "match_like", signal },
        })
      }
    }
    return NextResponse.json({
      ok: true,
      durable: true,
      signal,
      targetUserId,
      mutual,
      row,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "signal_failed" },
      { status: 500 }
    )
  }
}
