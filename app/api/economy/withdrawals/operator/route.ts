/**
 * POST /api/economy/withdrawals/operator — status transitions (ops only).
 * Authorization: GH_WITHDRAWAL_OPERATOR_IDS (comma user ids) or existing ops staff.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import {
  operatorSetWithdrawalStatus,
  type WithdrawalStatus,
} from "@/lib/server/economy/withdrawal"

const __ghNoStore = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
} as const

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isWithdrawalOperator(userId: string): boolean {
  const raw = String(process.env.GH_WITHDRAWAL_OPERATOR_IDS || "").trim()
  if (!raw) return false
  return raw.split(",").map((s) => s.trim()).filter(Boolean).includes(userId)
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: __ghNoStore })
  }
  if (!isWithdrawalOperator(auth.userId)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: __ghNoStore })
  }

  const parsed = await readBoundedJson(request, 4 * 1024)
  if (!parsed.ok) {
    const status = parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400
    return NextResponse.json({ ok: false, error: parsed.error }, { status, headers: __ghNoStore })
  }
  const body = parsed.value
  const id = String(body.id || body.withdrawalId || "").trim()
  const status = String(body.status || "").trim() as WithdrawalStatus
  const settlementRef = body.settlementRef == null ? "" : String(body.settlementRef).trim()
  const rejectReason = body.rejectReason == null ? "" : String(body.rejectReason).trim()
  if (!/^[A-Za-z0-9_-]{8,180}$/.test(id) || !status || status.length > 32 ||
      settlementRef.length > 180 || rejectReason.length > 500 ||
      /[\u0000-\u001f\u007f]/.test(settlementRef + rejectReason)) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400, headers: __ghNoStore })
  }

  const result = await operatorSetWithdrawalStatus({
    id,
    operatorId: auth.userId,
    status,
    settlementRef: settlementRef || undefined,
    rejectReason: rejectReason || undefined,
  })
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error || "UPDATE_FAILED", request: result.request },
      { status: 400 }
    )
  }
  return NextResponse.json({ ok: true, request: result.request })
}
