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

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const auth = await resolveAuthenticatedUser(req)
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
      return NextResponse.json({
        ok: true,
        durable: false,
        message: "SERVER_DB_UNAVAILABLE — session graph remains authority until migration + env",
        intents,
      })
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
      return NextResponse.json({
        ok: true,
        durable: false,
        message: "RPC_UNAVAILABLE",
        detail: text.slice(0, 200),
        intents,
      })
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
