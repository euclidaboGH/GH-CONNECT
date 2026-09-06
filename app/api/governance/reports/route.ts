/**
 * POST /api/governance/reports
 * Optional durable mirror for community safety reports.
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
      message: "Governance server mode off — report stored in session only on client.",
    })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const report = body?.report
    if (!report?.communityId || !report?.id) {
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
      reportId: report.id,
    })
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
