import { NextResponse } from "next/server"
import { buildPlatformCapabilities } from "@/lib/server/pi/platform-capabilities"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const matrix = buildPlatformCapabilities()
  return NextResponse.json(
    { ...matrix, ok: true, ts: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  )
}
