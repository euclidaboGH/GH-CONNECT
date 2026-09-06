/**
 * POST /api/governance/moderation-log
 * Optional durable mirror when GHC_GOVERNANCE_SERVER=1.
 * Without DB wiring, returns durable:false (honest).
 */
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  if (process.env.GHC_GOVERNANCE_SERVER !== "1") {
    return NextResponse.json({
      ok: true,
      durable: false,
      durability: "session",
      message: "Governance server mode off — client session log remains authoritative for this process only.",
    })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const entry = body?.entry
    if (!entry?.communityId || !entry?.action) {
      return NextResponse.json({ ok: false, error: "invalid_entry" }, { status: 400 })
    }

    // Durable table write requires applied migration 20260907_community_governance_log_proposal.sql
    // Until operator applies migration + wires Supabase insert, we do not claim durable:true.
    const dbConfigured = Boolean(
      process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    return NextResponse.json({
      ok: true,
      durable: false,
      durability: dbConfigured ? "server_pending_schema" : "session",
      message: dbConfigured
        ? "Server received log entry. Persist after governance migration is applied."
        : "No DB credentials — not durable.",
      entryId: entry.id || null,
    })
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
