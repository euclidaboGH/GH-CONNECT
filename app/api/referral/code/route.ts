import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { ensureReferralCode } from "@/lib/server/referral/referral-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET — ensure and return the caller's referral code */
export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const result = await ensureReferralCode(auth.userId)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 503 })
  }
  return NextResponse.json({
    ok: true,
    code: result.code,
    sharePath: `/join?ref=${encodeURIComponent(result.code)}`,
  })
}
