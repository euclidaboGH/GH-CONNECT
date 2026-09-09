/**
 * GET /api/health/live
 *
 * Liveness only — process is up. Does not check Supabase/Pi config.
 * Use for platform probes that should not fail the instance during config drift.
 * Prefer /api/health for release gates and human ops.
 */

import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      live: true,
      service: "gh-connect",
      ts: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  )
}
