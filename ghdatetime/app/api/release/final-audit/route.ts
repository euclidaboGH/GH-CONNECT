import { NextResponse } from "next/server"
import { evaluateFinalReleaseAudit } from "@/lib/server/release/final-audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const report = evaluateFinalReleaseAudit()
  return NextResponse.json(report, {
    status: report.status === "blocked" ? 503 : 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}
