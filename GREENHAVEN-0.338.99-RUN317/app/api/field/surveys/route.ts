import { NextResponse } from "next/server"
import { fieldTokenFromRequest } from "@/lib/server/field/access"
import { listFieldSurveys } from "@/lib/server/field/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const session = fieldTokenFromRequest(request)
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "FIELD_AUTH_REQUIRED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  }
  return NextResponse.json(
    { ok: true, surveys: listFieldSurveys() },
    { headers: { "Cache-Control": "no-store" } },
  )
}
