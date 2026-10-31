import { NextResponse } from "next/server"
import { buildListingCompliancePosture } from "@/lib/server/compliance/listing-posture"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const posture = buildListingCompliancePosture()
  return NextResponse.json(
    { ...posture, ok: true, ts: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  )
}
