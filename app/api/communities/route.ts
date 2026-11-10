/**
 * GET  /api/communities — list public communities
 * POST /api/communities — create (owner = session user)
 */
import { NextResponse } from "next/server"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableReadResponse, nonDurableWriteResponse } from "@/lib/server/production-guard"
import { enforceUserMutationRateLimit } from "@/lib/server/security/user-rate-limit"
import { feesRequireSettlement, quoteCommunityCreateFee } from "@/lib/server/fees/pilot-fee-policy"
import { settlePilotFee } from "@/lib/server/fees/settle-pilot-fee"
import { ensureCommunityConversation } from "@/lib/server/messaging/message-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function genId() {
  return `com_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  // Listing public communities may be useful pre-auth; still prefer session when present
  // auth used for membership enrichment below

  if (!socialDbConfigured()) {
    const nd = nonDurableReadResponse("Communities list", { communities: [] })
    return NextResponse.json(nd.body, {
      status: nd.status,
      headers: { "Cache-Control": "no-store" },
    })
  }

  const url = new URL(request.url)
  const rawLimit = url.searchParams.get("limit") || "50"
  const rawOffset = url.searchParams.get("offset") || "0"
  const query = (url.searchParams.get("q") || "").normalize("NFKC").trim().slice(0, 160)
  const category = (url.searchParams.get("category") || "").trim().slice(0, 64)
  if (!/^\d{1,3}$/.test(rawLimit) || !/^\d{1,6}$/.test(rawOffset) || Number(rawOffset) > 100000 || (category && !/^[\p{L}\p{N}][\p{L}\p{N} &+/_.-]{0,63}$/u.test(category))) {
    return NextResponse.json({ ok: false, error: "INVALID_FILTER_QUERY" }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  const limit = Math.min(Math.max(Number(rawLimit), 1), 100)
  const offset = Number(rawOffset)
  const filtered = Boolean(query || category || offset)
  const result = filtered
    ? await socialRpc("gh_community_search_public", { p_query: query, p_category: category || null, p_limit: limit, p_offset: offset })
    : await socialRpc("gh_community_list_public", { p_limit: limit })
  if (!result.ok && filtered) {
    return NextResponse.json({ ok: false, error: "FILTER_SEARCH_UNAVAILABLE", requiresMigration: "20261108120001_gh_community_server_filter_search.sql" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
  if (!result.ok) return NextResponse.json({ ok: false, error: "COMMUNITY_DIRECTORY_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  const data = result.data as { communities?: unknown[]; pagination?: Record<string, unknown> }
  let communities: unknown[] = Array.isArray(data?.communities) ? data.communities : []

  // Phase 3: when authenticated, mark viewer membership so "My communities" is truthful.
  if (auth?.userId) {
    try {
      const mine = await socialRpc("gh_community_list_memberships", {
        p_user_id: auth.userId,
        p_limit: 100,
      })
      const mdata = mine.data as { memberships?: Array<Record<string, unknown>> }
      const memberships = Array.isArray(mdata?.memberships) ? mdata.memberships : []
      const byId = new Map<string, Record<string, unknown>>()
      for (const row of memberships) {
        const cid = String(row.communityId || row.community_id || "").trim()
        if (cid) byId.set(cid, row)
      }
      const seen = new Set<string>()
      communities = communities.map((raw) => {
        if (!raw || typeof raw !== "object") return raw
        const c = { ...(raw as Record<string, unknown>) }
        const id = String(c.id || "").trim()
        const m = id ? byId.get(id) : undefined
        if (m) {
          c.viewerIsMember = true
          c.viewerRole = m.role || "member"
          const members = Array.isArray(c.members) ? [...(c.members as string[])] : []
          if (!members.includes(auth.userId)) members.push(auth.userId)
          c.members = members
          const roles = { ...((c.groupRoles as Record<string, string>) || {}) }
          roles[auth.userId] = String(m.role || "member")
          c.groupRoles = roles
          seen.add(id)
        } else {
          c.viewerIsMember = false
        }
        return c
      })
      // Include private/invite communities the user belongs to that public list omitted
      for (const [cid, m] of byId) {
        if (seen.has(cid)) continue
        communities.push({
          id: cid,
          name: m.name || "Community",
          memberCount: m.memberCount ?? m.member_count,
          privacy: m.privacy,
          category: m.category,
          createdBy: m.createdBy || m.created_by,
          viewerIsMember: true,
          viewerRole: m.role || "member",
          members: [auth.userId],
          groupRoles: { [auth.userId]: String(m.role || "member") },
        })
      }
    } catch {
      /* membership enrichment is best-effort; public list still returns */
    }
  }

  return NextResponse.json(
    {
      ok: true,
      durable: result.ok,
      communities,
      ...(data?.pagination ? { pagination: data.pagination } : filtered ? { pagination: { limit, offset, returned: communities.length, filtering: "server-side" } } : {}),
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const rateLimited = await enforceUserMutationRateLimit(auth.userId, "communities:POST", 5, 60_000, { failClosed: true })
  if (rateLimited) return rateLimited

  const parsedBody = await readBoundedJson(request, 16 * 1024)
  if (!parsedBody.ok) return NextResponse.json({ ok: false, error: parsedBody.error }, { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: { "Cache-Control": "no-store" } })
  const body = parsedBody.value
  // Creator is always session — never trust client ownership fields
  void body.createdBy
  void body.ownerId
  void body.userId
  void body.creatorId

  const name = String(body.name || "").trim()
  if (!name || name.length > 80) {
    return NextResponse.json({ ok: false, error: "INVALID_NAME" }, { status: 400 })
  }

  // Fail before charging a fee when durable community persistence is unavailable.
  // A paid community must never be represented as created by an in-memory fallback.
  if (!socialDbConfigured()) {
    const nd = nonDurableWriteResponse("Community create", { extra: { community: null } })
    return NextResponse.json(nd.body, { status: nd.status })
  }

  // Stage 5: community create fee — collection only when env rates approved.
  const feeQuote = quoteCommunityCreateFee(
    String(body.feeCurrency || "").toUpperCase() === "PI" ? "PI" : "GHC"
  )
  const feePaymentIdEarly = String(body.feePaymentId || body.feeIntentId || "").trim()
  if (feesRequireSettlement(feeQuote) && feeQuote.feeCurrency === "PI" && !feePaymentIdEarly) {
    return NextResponse.json(
      {
        ok: false,
        error: "COMMUNITY_CREATE_FEE_REQUIRED",
        fee: feeQuote,
        message: "Community creation requires a completed Pi payment intent when Pi fees are activated.",
      },
      { status: 402 }
    )
  }

  const privacy = ["public", "private", "invite-only"].includes(String(body.privacy || ""))
    ? String(body.privacy)
    : "public"

  // Prefer stable client/community id so chat membership and UI conversation share one key
  const clientId = String(body.id || body.conversationId || "").trim()
  const stableId =
    clientId &&
    clientId.length >= 8 &&
    clientId.length <= 80 &&
    /^[a-zA-Z0-9_-]+$/.test(clientId)
      ? clientId
      : genId()
  const row = {
    id: stableId,
    name,
    purpose: String(body.purpose || "").slice(0, 200),
    description: String(body.description || "").slice(0, 2000),
    category: String(body.category || "general").slice(0, 40),
    privacy,
    createdBy: auth.userId,
    coverImage: body.coverImage ? String(body.coverImage).slice(0, 2000) : null,
    rules: Array.isArray(body.rules) ? body.rules.slice(0, 20) : [],
    tags: Array.isArray(body.tags) ? body.tags.slice(0, 20) : [],
    welcomeMessage: String(body.welcomeMessage || "").slice(0, 500),
    conversationId: stableId,
  }

  if (feesRequireSettlement(feeQuote)) {
    const referenceId = `community_create_fee_${row.id}`
    const settled = await settlePilotFee({
      userId: auth.userId,
      fee: feeQuote,
      referenceId,
      reason: `Community create fee · ${name}`,
      sourceEvent: "COMMUNITY_CREATE_FEE",
      paymentRef: feePaymentIdEarly || null,
      bindKey: "communityId",
      bindValue: row.id,
    })
    if (!settled.ok) {
      const err = settled.error || "FEE_SETTLEMENT_FAILED"
      const status =
        err === "INSUFFICIENT_BALANCE"
          ? 400
          : err === "FEE_PAYMENT_REQUIRED" || err === "FEE_PAYMENT_NOT_COMPLETED"
            ? 402
            : err === "SERVER_UNAVAILABLE"
              ? 503
              : 400
      return NextResponse.json(
        {
          ok: false,
          error: err,
          fee: feeQuote,
          message:
            err === "INSUFFICIENT_BALANCE"
              ? "Insufficient available GHC to create this community."
              : "Community create fee could not be settled. Pay the fee then retry.",
        },
        { status }
      )
    }
  }

  const result = await socialRpc("gh_community_create", { p_row: row })
  const data = result.data as { ok?: boolean; error?: string }
  if (!result.ok || data?.ok === false) {
    return NextResponse.json(
      { ok: false, error: data?.error || result.error || "CREATE_FAILED" },
      { status: 503 }
    )
  }
  if (!row || (typeof row === "object" && (row as { id?: string }).id == null && !(row as { community?: unknown }).community)) {
    return NextResponse.json(
      { ok: false, error: "CREATE_CONFLICT_OR_EMPTY", message: "Community was not created" },
      { status: 409 }
    )
  }
  // Chat channel + membership so the creator can message immediately
  await ensureCommunityConversation({
    communityId: String(row.id),
    ownerId: auth.userId,
    title: name,
  })
  return NextResponse.json({ ok: true, durable: true, community: row })
}
