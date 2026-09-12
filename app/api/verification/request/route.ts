/**
 * POST /api/verification/request
 * Client may request verification (pending only). Does not grant verified status.
 */
import { NextRequest, NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveAuthenticatedUser(req.headers)
    if (!auth?.userId) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const type = String(body?.type || "identity")
    const allowed = ["identity", "creator", "business", "organization"]
    if (!allowed.includes(type)) {
      return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 })
    }

    // No durable reviewer queue in this deployment — do not claim secure storage.
    return NextResponse.json(
      {
        ok: false,
        error: "VERIFICATION_QUEUE_UNAVAILABLE",
        message:
          "Verification requests are not durably stored yet. Your account was authenticated, but no review queue is configured.",
        type,
        userId: auth.userId,
      },
      { status: 503 },
    )
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
