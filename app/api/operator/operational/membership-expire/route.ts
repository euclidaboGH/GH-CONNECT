import { NextResponse } from "next/server"
import { assertOperatorKey, callOperationalRpc } from "@/lib/server/marketplace/operational-rpc"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store, max-age=0" }

/** Bounded operator-only expiry sweep. It never changes payment or refund records. */
export async function POST(request: Request) {
  if (!assertOperatorKey(request.headers.get("x-ghc-operator-key"))) {
    return NextResponse.json({ ok: false, error: "OPERATOR_UNAUTHORIZED" }, { status: 401, headers: noStore })
  }
  const parsed = await readBoundedJson(request, 4 * 1024)
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, {
      status: parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400,
      headers: noStore,
    })
  }
  const rawLimit = Number(parsed.value.limit ?? 500)
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 2_000) {
    return NextResponse.json({ ok: false, error: "INVALID_LIMIT", max: 2000 }, { status: 400, headers: noStore })
  }
  const result = await callOperationalRpc("ghc_membership_expire_due", { p_limit: rawLimit })
  if (!result || result.ok !== true) {
    return NextResponse.json({ ok: false, error: "MEMBERSHIP_EXPIRY_SWEEP_UNAVAILABLE" }, { status: 503, headers: noStore })
  }
  return NextResponse.json({
    ok: true,
    expiredCount: Number.isFinite(Number(result.expiredCount)) ? Number(result.expiredCount) : 0,
    mutatesPaymentRecords: false,
  }, { headers: noStore })
}
