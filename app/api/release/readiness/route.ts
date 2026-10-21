import { NextResponse } from "next/server"
import { getStage7ReadinessPolicy } from "@/lib/server/release/stage7-readiness"

export const dynamic = "force-static"
export const revalidate = 60

export async function GET() {
  return NextResponse.json(getStage7ReadinessPolicy(), {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
  })
}
