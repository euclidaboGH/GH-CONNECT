import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialRest } from "@/lib/server/social/rpc"
import { canAppearInMatchInbox, blockedPeerIdsForViewer, encodePostgrestInList, readMatchInboxPrivacy } from "@/lib/server/social/match-inbox-policy"
import { checkDurableRateLimit } from "@/lib/server/security/control-plane"

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
    const rl = await checkDurableRateLimit(`matching-inbox:${auth.userId}`, 60, 60_000, { onUnavailable: "deny" })
    if (!rl.ok) return NextResponse.json({ ok: false, error: rl.unavailable ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, { status: rl.unavailable ? 503 : 429, headers: { "Cache-Control": "no-store", "Retry-After": String(rl.retryAfterSec) } })
    const signalsBase = "ghc_match_signals"
    const [outResult, inResult, blockResult] = await Promise.all([
      socialRest<Array<Record<string, unknown>>>(`${signalsBase}?from_user_id=eq.${encodeURIComponent(auth.userId)}&select=from_user_id,to_user_id,signal,created_at,updated_at&order=updated_at.desc&limit=200`),
      socialRest<Array<Record<string, unknown>>>(`${signalsBase}?to_user_id=eq.${encodeURIComponent(auth.userId)}&signal=in.(like,superlike)&select=from_user_id,to_user_id,signal,created_at,updated_at&order=updated_at.desc&limit=200`),
      socialRest<Array<{ blocker_id?: unknown; blocked_id?: unknown }>>(`ghc_user_blocks?or=(blocker_id.eq.${encodeURIComponent(auth.userId)},blocked_id.eq.${encodeURIComponent(auth.userId)})&select=blocker_id,blocked_id&limit=1001`),
    ])

    // A partial block list or failed source query must never widen inbox visibility.
    if (!outResult.ok || !inResult.ok || !blockResult.ok || !Array.isArray(outResult.data) || !Array.isArray(inResult.data) || !Array.isArray(blockResult.data) || blockResult.data.length > 1000) {
      return NextResponse.json({ ok: false, durable: false, error: "MATCH_INBOX_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "private, no-store" } })
    }

    const outgoing = outResult.data
    const incoming = inResult.data
    const blocked = blockedPeerIdsForViewer(auth.userId, blockResult.data)
    const candidateIds = [...new Set([
      ...outgoing.map((row) => String(row.to_user_id || "")),
      ...incoming.map((row) => String(row.from_user_id || "")),
    ].filter((id) => id && id !== auth.userId && !blocked.has(id)))].slice(0, 400)

    const profileResult = candidateIds.length
      ? await socialRest<Array<{ gh_user_id?: unknown; profile_payload?: unknown }>>(
          `gh_user_profiles?gh_user_id=${encodeURIComponent(encodePostgrestInList(candidateIds))}&select=gh_user_id,profile_payload&limit=400`
        )
      : { ok: true, data: [] as Array<{ gh_user_id?: unknown; profile_payload?: unknown }>, status: 200 }

    if (!profileResult.ok || !Array.isArray(profileResult.data)) {
      return NextResponse.json({ ok: false, durable: false, error: "MATCH_INBOX_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "private, no-store" } })
    }

    type MatchInboxPrivacy = ReturnType<typeof readMatchInboxPrivacy>
    const privacyEntries: Array<[string, MatchInboxPrivacy]> = profileResult.data
      .map((row): [string, MatchInboxPrivacy] => [
        String(row.gh_user_id || ""),
        readMatchInboxPrivacy(row.profile_payload),
      ])
      .filter(([id]) => Boolean(id))
    const privacyByPeer = new Map<string, MatchInboxPrivacy>(privacyEntries)
    const outgoingRawLikes = outgoing.filter((row) => row.signal === "like" || row.signal === "superlike")
    const incomingRawLikes = incoming.filter((row) => row.signal === "like" || row.signal === "superlike")
    const outgoingPeerIds = new Set(outgoingRawLikes.map((row) => String(row.to_user_id || "")).filter(Boolean))
    const incomingPeerIds = new Set(incomingRawLikes.map((row) => String(row.from_user_id || "")).filter(Boolean))
    const visible = (peerId: string) => {
      if (!peerId || blocked.has(peerId)) return false
      const privacy = privacyByPeer.get(peerId)
      if (!privacy) return false
      const mutual = outgoingPeerIds.has(peerId) && incomingPeerIds.has(peerId)
      return canAppearInMatchInbox(privacy, mutual)
    }

    const outLikes = outgoingRawLikes
      .filter((row) => visible(String(row.to_user_id || "")))
      .map((row) => ({
        toUserId: String(row.to_user_id || ""),
        signal: String(row.signal || "like"),
        createdAt: Number.isFinite(Date.parse(String(row.created_at || ""))) ? Date.parse(String(row.created_at)) : 0,
      }))
      .filter((row) => row.toUserId)

    const passes = outgoing
      .filter((row) => row.signal === "pass")
      .map((row) => String(row.to_user_id || ""))
      .filter((peerId) => peerId && !blocked.has(peerId))

    const inLikes = incomingRawLikes
      .filter((row) => visible(String(row.from_user_id || "")))
      .map((row) => ({
        fromUserId: String(row.from_user_id || ""),
        signal: String(row.signal || "like"),
        createdAt: Number.isFinite(Date.parse(String(row.created_at || ""))) ? Date.parse(String(row.created_at)) : 0,
      }))
      .filter((row) => row.fromUserId)

    const outSet = new Set(outLikes.map((row) => row.toUserId))
    const matches = inLikes
      .filter((row) => outSet.has(row.fromUserId))
      .map((row) => ({ userId: row.fromUserId, createdAt: row.createdAt }))

    return NextResponse.json({ ok: true, durable: true, outgoingLikes: outLikes, incomingLikes: inLikes, matches, passes }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "inbox_failed" },
      { status: 500 }
    )
  }
}
