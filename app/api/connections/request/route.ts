/**
 * POST /api/connections/request
 * Durable connection request + intents (requires migration applied).
 * Does not replace session graph — dual-writes when DB available.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { normalizeIntents } from "@/lib/connection-intents"
import { validateConnectionIntents } from "@/lib/domains/adapters/unified-connection-request"
import { nonDurableWriteResponse } from "@/lib/server/production-guard"
import { emitSocialNotification } from "@/lib/server/social/notifications"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const auth = await resolveAuthenticatedUser(req.headers)
    if (!auth?.userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 })
    }
    const body = (await req.json().catch(() => ({}))) as {
      toUserId?: string
      intents?: string[]
      note?: string
      source?: string
    }
    const toUserId = String(body.toUserId || "").trim()
    if (!toUserId || toUserId === auth.userId) {
      return NextResponse.json({ ok: false, error: "INVALID_PAIR" }, { status: 400 })
    }
    const validated = validateConnectionIntents(body.intents || [])
    if (!validated.ok) {
      return NextResponse.json({ ok: false, error: validated.error }, { status: 400 })
    }
    const intents = validated.intents
    // Relationship state is re-checked server-side when durable RPCs exist; never trust client "already connected"
    const env = readGhcServerEnv()
    if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
      const nd = nonDurableWriteResponse("Connection request", {
        extra: {
          message: "SERVER_DB_UNAVAILABLE — session graph remains authority until migration + env",
          intents,
        },
      })
      return NextResponse.json(nd.body, { status: nd.status })
    }

    const res = await fetch(`${env.supabaseUrl}/rest/v1/rpc/ghc_connection_request_upsert`, {
      method: "POST",
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_from_user_id: auth.userId,
        p_to_user_id: toUserId,
        p_intents: intents,
        p_note: body.note || null,
        p_source: body.source || "discover",
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      // Function missing until migration applied
      const nd = nonDurableWriteResponse("Connection request", {
        extra: {
          message: "RPC_UNAVAILABLE",
          detail: text.slice(0, 200),
          intents,
        },
      })
      return NextResponse.json(nd.body, { status: nd.status })
    }
    const row = await res.json().catch(() => null)
    // Phase 8: notify recipient of durable connection request
    void emitSocialNotification({
      recipientUserId: toUserId,
      actorUserId: auth.userId,
      type: "follow",
      entityType: "user",
      entityId: auth.userId,
      title: "Connection request",
      body: "Someone wants to connect with you on GreenHaven",
      dedupeKey: `connection_request:${auth.userId}:${toUserId}`,
      metadata: { kind: "connection_request", intents, source: body.source || "discover" },
    })
    return NextResponse.json({ ok: true, durable: true, request: row, intents })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "request_failed" },
      { status: 500 }
    )
  }
}


/** List pending connection requests for the authenticated user (incoming + outgoing). */
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
        incoming: [],
        outgoing: [],
        message: "DB_UNAVAILABLE",
      })
    }
    const uid = auth.userId
    const base = env.supabaseUrl.replace(/\/$/, "")
    const headers = {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      Accept: "application/json",
    }
    // Incoming: to_user_id = me, pending
    const inUrl =
      `${base}/rest/v1/ghc_connection_requests` +
      `?to_user_id=eq.${encodeURIComponent(uid)}&status=eq.pending&select=*&order=created_at.desc&limit=50`
    // Outgoing: from_user_id = me, pending
    const outUrl =
      `${base}/rest/v1/ghc_connection_requests` +
      `?from_user_id=eq.${encodeURIComponent(uid)}&status=eq.pending&select=*&order=created_at.desc&limit=50`
    const [inRes, outRes] = await Promise.all([
      fetch(inUrl, { headers, cache: "no-store" }),
      fetch(outUrl, { headers, cache: "no-store" }),
    ])
    if (!inRes.ok || !outRes.ok) {
      return NextResponse.json({
        ok: true,
        durable: false,
        incoming: [],
        outgoing: [],
        message: "QUERY_FAILED",
      })
    }
    const incomingRows = (await inRes.json().catch(() => [])) as Array<Record<string, unknown>>
    const outgoingRows = (await outRes.json().catch(() => [])) as Array<Record<string, unknown>>
    const mapRow = (row: Record<string, unknown>, direction: "incoming" | "outgoing") => ({
      id: String(row.id || ""),
      fromUserId: String(row.from_user_id || ""),
      toUserId: String(row.to_user_id || ""),
      direction,
      status: String(row.status || "pending"),
      intents: Array.isArray(row.intents) ? row.intents : [],
      note: row.note ? String(row.note) : undefined,
      source: row.source ? String(row.source) : undefined,
      createdAt: row.created_at ? new Date(String(row.created_at)).getTime() : Date.now(),
    })
    const incoming = (Array.isArray(incomingRows) ? incomingRows : []).map((r) =>
      mapRow(r, "incoming")
    )
    const outgoing = (Array.isArray(outgoingRows) ? outgoingRows : []).map((r) =>
      mapRow(r, "outgoing")
    )
    return NextResponse.json({
      ok: true,
      durable: true,
      incoming,
      outgoing,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "list_failed" },
      { status: 500 }
    )
  }
}
