/**
 * POST /api/governance/reports
 * Optional durable mirror for community safety reports.
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
      message: "Governance server mode off — report stored in session only on client.",
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
    const candidate = parsed.value.report
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return NextResponse.json({ ok: false, error: "invalid_report" }, { status: 400 })
    }
    const report = candidate as Record<string, unknown>
    const communityId = typeof report.communityId === "string" ? report.communityId.trim() : ""
    const reportId = typeof report.id === "string" ? report.id.trim() : ""
    if (!communityId || communityId.length > 128 || !reportId || reportId.length > 160) {
      return NextResponse.json({ ok: false, error: "invalid_report" }, { status: 400 })
    }

    const dbConfigured = Boolean(
      process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    return NextResponse.json({
      ok: true,
      durable: false,
      durability: dbConfigured ? "server_pending_schema" : "session",
      message: dbConfigured
        ? "Server received report. Persist after governance migration is applied."
        : "No DB credentials — not durable.",
      reportId,
    })
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
