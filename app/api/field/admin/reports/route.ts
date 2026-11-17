/**
 * GET /api/field/admin/reports
 * Operator reconcile key required. Returns latest field desk reports for the central admin.
 */
import { NextResponse } from "next/server"
import { operatorDiagnosticsAuthorized } from "@/lib/server/security/operator-key"
import { listFieldReports } from "@/lib/server/field/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!operatorDiagnosticsAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: { "Cache-Control": "no-store" } })
  }
  const url = new URL(request.url)
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50) || 50))
  const reports = await listFieldReports(limit)
  return NextResponse.json(
    { ok: true, count: reports.length, reports },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
