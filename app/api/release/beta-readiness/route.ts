import { NextResponse } from "next/server"
import { evaluateBetaReadiness } from "@/lib/server/release/beta-readiness"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  let hostname: string | null = null
  try { hostname = new URL(request.url).hostname } catch { /* ignore */ }
  const report = evaluateBetaReadiness({ hostname })
  return NextResponse.json(report, {
    status: report.status === "blocked" ? 503 : 200,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "X-GH-Beta-Readiness": report.status },
  })
}
