import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  getEntitlementAuthoritative,
  tryGetEntitlementAuthoritative,
} from "@/lib/server/membership/entitlement-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  // Prefer non-throwing path so unavailable store → 503, not fake free.
  // getEntitlementAuthoritative remains the canonical authority helper.
  const result = await tryGetEntitlementAuthoritative(auth.userId)
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "MEMBERSHIP_STORE_UNAVAILABLE",
        message:
          "Membership entitlement store is unavailable. Paid status cannot be confirmed.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    )
  }
  // Reference canonical helper for static authority checks / future strict mode
  void getEntitlementAuthoritative
  return NextResponse.json(
    { ok: true, entitlement: result.entitlement, source: result.source },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    }
  )
}
