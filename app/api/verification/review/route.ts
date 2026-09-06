/**
 * POST /api/verification/review
 * Privileged approve/reject/revoke — server only.
 * Requires GHC_VERIFICATION_SERVER=1 and service authorization.
 * Never callable as a public client shortcut without secrets.
 */
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  if (process.env.GHC_VERIFICATION_SERVER !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error: "VERIFICATION_PRIVILEGED_BLOCKED",
        message: "Verification review is not enabled on this server.",
      },
      { status: 403 }
    )
  }

  const serviceKey = process.env.VERIFICATION_REVIEW_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  const provided =
    req.headers.get("x-verification-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")

  if (!serviceKey || !provided || provided !== serviceKey) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || "")
    const targetUserId = String(body?.targetUserId || "")
    const type = String(body?.type || "identity")
    if (!["approve", "reject", "revoke"].includes(action) || !targetUserId) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
    }
    // Durable write path is environment-specific; respond with accepted review intent.
    // Operators wire this to DB reviewer workflow before Mainnet trust claims.
    return NextResponse.json({
      ok: true,
      action,
      targetUserId,
      type,
      status:
        action === "approve" ? "verified" : action === "reject" ? "rejected" : "revoked",
      durable: false,
      message:
        "Review action authorized at API boundary. Persist via server DB before treating as production truth.",
    })
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
