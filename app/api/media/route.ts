/**
 * POST /api/media — media upload endpoint.
 * Not fully wired to object storage in this revision.
 * Returns 501 so clients do not treat blob URLs as durable.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  void request
  return NextResponse.json(
    {
      ok: false,
      error: "MEDIA_STORAGE_UNAVAILABLE",
      message:
        "Authenticated media object storage is not configured. Local blob URLs must not be treated as durable cross-device media.",
    },
    { status: 501 }
  )
}
