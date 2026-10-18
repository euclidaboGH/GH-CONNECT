import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { attributeReferral } from "@/lib/server/referral/referral-service"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** POST — attribute the authenticated user to a referral code (once) */
export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  const raw = await request.json().catch(() => ({}))
  const parsed = z.object({ code: z.string().min(2).max(32) }).safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 })
  }
  const result = await attributeReferral(auth.userId, parsed.data.code)
  if (!result.ok) {
    const status = result.error === "SELF_REFERRAL" || result.error === "INVALID_CODE" ? 400 : 503
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }
  return NextResponse.json({
    ok: true,
    idempotent: result.idempotent,
    // Do not expose referrer identity details beyond success
  })
}
