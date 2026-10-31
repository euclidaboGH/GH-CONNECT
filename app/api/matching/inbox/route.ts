import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/matching/inbox
 * Returns durable outgoing likes, incoming likes, and computed mutual matches.
 */
export async function GET(req: Request) {
  try {
    const auth = await resolveAuthenticatedUser(req.headers)
    if (!auth?.userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
    }
    const env = readGhcServerEnv()
    if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
      return NextResponse.json({
        ok: true,
        durable: false,
        outgoingLikes: [],
        incomingLikes: [],
        matches: [],
        passes: [],
      })
    }

    const base = env.supabaseUrl.replace(/\/$/, "")
    const headers = {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      Accept: "application/json",
    }
    const uid = auth.userId

    const outUrl =
      `${base}/rest/v1/ghc_match_signals?from_user_id=eq.${encodeURIComponent(uid)}` +
      `&select=*&order=updated_at.desc&limit=200`
    const inUrl =
      `${base}/rest/v1/ghc_match_signals?to_user_id=eq.${encodeURIComponent(uid)}` +
      `&signal=in.(like,superlike)&select=*&order=updated_at.desc&limit=200`

    const [outRes, inRes] = await Promise.all([
      fetch(outUrl, { headers, cache: "no-store" }),
      fetch(inUrl, { headers, cache: "no-store" }),
    ])

    if (!outRes.ok || !inRes.ok) {
      return NextResponse.json({
        ok: true,
        durable: false,
        outgoingLikes: [],
        incomingLikes: [],
        matches: [],
        passes: [],
        message: "QUERY_FAILED",
      })
    }

    const outgoing = (await outRes.json().catch(() => [])) as Array<Record<string, unknown>>
    const incoming = (await inRes.json().catch(() => [])) as Array<Record<string, unknown>>

    const outLikes = (Array.isArray(outgoing) ? outgoing : [])
      .filter((r) => r.signal === "like" || r.signal === "superlike")
      .map((r) => ({
        toUserId: String(r.to_user_id || ""),
        signal: String(r.signal || "like"),
        createdAt: r.created_at ? new Date(String(r.created_at)).getTime() : Date.now(),
      }))
      .filter((r) => r.toUserId)

    const passes = (Array.isArray(outgoing) ? outgoing : [])
      .filter((r) => r.signal === "pass")
      .map((r) => String(r.to_user_id || ""))
      .filter(Boolean)

    const inLikes = (Array.isArray(incoming) ? incoming : [])
      .map((r) => ({
        fromUserId: String(r.from_user_id || ""),
        signal: String(r.signal || "like"),
        createdAt: r.created_at ? new Date(String(r.created_at)).getTime() : Date.now(),
      }))
      .filter((r) => r.fromUserId)

    const outSet = new Set(outLikes.map((r) => r.toUserId))
    const matches = inLikes
      .filter((r) => outSet.has(r.fromUserId))
      .map((r) => ({
        userId: r.fromUserId,
        createdAt: r.createdAt,
      }))

    return NextResponse.json({
      ok: true,
      durable: true,
      outgoingLikes: outLikes,
      incomingLikes: inLikes,
      matches,
      passes,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "inbox_failed" },
      { status: 500 }
    )
  }
}
