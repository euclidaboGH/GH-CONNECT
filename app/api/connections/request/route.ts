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
    return NextResponse.json({ ok: true, durable: true, request: row, intents })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "request_failed" },
      { status: 500 }
    )
  }
}
