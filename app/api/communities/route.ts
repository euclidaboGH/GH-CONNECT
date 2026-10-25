/**
 * GET  /api/communities — list public communities
 * POST /api/communities — create (owner = session user)
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { nonDurableReadResponse, nonDurableWriteResponse } from "@/lib/server/production-guard"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
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
  void auth

  if (!socialDbConfigured()) {
    const nd = nonDurableReadResponse("Communities list", { communities: [] })
    return NextResponse.json(nd.body, {
      status: nd.status,
      headers: { "Cache-Control": "no-store" },
    })
  }

  const limit = Math.min(
    Math.max(Number(new URL(request.url).searchParams.get("limit") || 50), 1),
    100
  )
  const result = await socialRpc("gh_community_list_public", { p_limit: limit })
  const data = result.data as { communities?: unknown[] }
  return NextResponse.json(
    {
      ok: true,
      durable: result.ok,
      communities: Array.isArray(data?.communities) ? data.communities : [],
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const rl = checkRateLimit(`community-create:${auth.userId}`, 5, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }

  const body = await request.json().catch(() => ({}))
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
