/**
 * GET /api/health
 *
 * Foundation readiness probe (not a dumb { ok: true } liveness ping).
 * - runtime=nodejs (same as auth/payments)
 * - Cache-Control: no-store
 * - 503 when production AND critical blockers (Client ID, API key, durable identity)
 * - 200 with status=degraded|ready otherwise
 *
 * For process-only liveness use GET /api/health/live
 */

import { NextResponse } from "next/server"
import {
  evaluateReadiness,
  readinessHttpStatus,
} from "@/lib/server/readiness"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  let hostname: string | null = null
  try {
    hostname = new URL(request.url).hostname
  } catch {
    /* */
  }

  const report = evaluateReadiness({ hostname })
  const status = readinessHttpStatus(report)

  return NextResponse.json(report, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-GH-Readiness": report.status,
    },
  })
}
