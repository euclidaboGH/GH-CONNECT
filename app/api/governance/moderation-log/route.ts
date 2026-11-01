/**
 * POST /api/governance/moderation-log
 * Optional durable mirror when GHC_GOVERNANCE_SERVER=1.
 * Without DB wiring, returns durable:false (honest).
 */
import { NextRequest, NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

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

  const auth = await resolveAuthenticatedUser(req.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  try {
    const parsed = await readBoundedJson(req, 12 * 1024)
    if (!parsed.ok) {
      const status = parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400
      return NextResponse.json({ ok: false, error: parsed.error }, { status })
    }
    const candidate = parsed.value.entry
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return NextResponse.json({ ok: false, error: "invalid_entry" }, { status: 400 })
    }

    // JSON is untrusted input: narrow the unknown value before accessing fields.
    const entry = candidate as Record<string, unknown>
    const communityId = typeof entry.communityId === "string" ? entry.communityId.trim() : ""
    const action = typeof entry.action === "string" ? entry.action.trim() : ""
    const entryId = typeof entry.id === "string" ? entry.id.trim() : ""
    if (!communityId || communityId.length > 128 || !action || action.length > 80 || entryId.length > 128) {
      return NextResponse.json({ ok: false, error: "invalid_entry" }, { status: 400 })
    }

    // Durable table write requires applied migration 20261022010017_community_governance_log_proposal.sql
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
      entryId: entryId || null,
    })
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
