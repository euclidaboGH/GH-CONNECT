/**
 * POST /api/economy/withdrawals/operator — status transitions (ops only).
 * Authorization: GH_WITHDRAWAL_OPERATOR_IDS (comma user ids) or existing ops staff.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import {
  operatorSetWithdrawalStatus,
  type WithdrawalStatus,
} from "@/lib/server/economy/withdrawal"

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
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  if (!isWithdrawalOperator(auth.userId)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const id = String(body.id || body.withdrawalId || "").trim()
  const status = String(body.status || "").trim() as WithdrawalStatus
  if (!id || !status) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 })
  }

  const result = await operatorSetWithdrawalStatus({
    id,
    operatorId: auth.userId,
    status,
    settlementRef: body.settlementRef ? String(body.settlementRef) : undefined,
    rejectReason: body.rejectReason ? String(body.rejectReason) : undefined,
  })
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error || "UPDATE_FAILED", request: result.request },
      { status: 400 }
    )
  }
  return NextResponse.json({ ok: true, request: result.request })
}
