import { NextResponse } from "next/server"
import { evaluateFinalReleaseAudit } from "@/lib/server/release/final-audit"
import { diagnosticsDetailAllowed } from "@/lib/server/security/operator-key"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  const report = evaluateFinalReleaseAudit()
  if (!diagnosticsDetailAllowed(request)) {
    return NextResponse.json(
      { ok: report.status !== "blocked", status: report.status, detail: "restricted" },
      { status: report.status === "blocked" ? 503 : 200, headers: { "Cache-Control": "no-store, max-age=0" } },
    )
  }
  return NextResponse.json(report, {
    status: report.status === "blocked" ? 503 : 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}
