/**
 * POST /api/verification/request
 * Client may request verification (pending only). Does not grant verified status.
 */
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const type = String(body?.type || "identity")
    const allowed = ["identity", "creator", "business", "organization"]
    if (!allowed.includes(type)) {
      return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 })
    }
    // Auth: prefer bearer; do not trust body.userId alone in production
    const auth = req.headers.get("authorization") || ""
    if (!auth && process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    }
    // Staging record only — durable reviewer queue is future server work
    return NextResponse.json({
      ok: true,
      status: "pending",
      type,
      message: "Verification request accepted for review. This does not grant a verified badge.",
    })
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
