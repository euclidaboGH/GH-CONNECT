/** Phase 9 — Operator platform utility summary (fees, charity, sinks). */
import { NextResponse } from "next/server"
import { operatorDiagnosticsAuthorized } from "@/lib/server/security/operator-key"
import { getPlatformUtilitySummary } from "@/lib/server/earnings/platform-utility"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore })
}

function authorized(request: Request): boolean {
  return operatorDiagnosticsAuthorized(request)
}

export async function GET(request: Request) {
  if (!authorized(request)) return reply({ ok: false, error: "FORBIDDEN" }, 403)
  const summary = await getPlatformUtilitySummary()
  if (!summary?.ok) {
    return reply({ ok: false, error: summary?.error || "PLATFORM_SUMMARY_UNAVAILABLE" }, 503)
  }
  return reply({ ...summary, ok: true })
}
