import { NextResponse } from "next/server"
import { assertOperatorKey } from "@/lib/server/marketplace/operational-rpc"
import {
  applyPayoutCorrection,
  dryRunPayoutCorrection,
  recordPayoutCorrectionApproval,
  type CorrectionType,
} from "@/lib/server/marketplace/operational-payout-corrections"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "private, no-store, max-age=0" }

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: noStore })
}

export async function POST(request: Request) {
  if (!assertOperatorKey(request.headers.get("x-ghc-operator-key"))) {
    return reply({ ok: false, error: "OPERATOR_UNAUTHORIZED" }, 401)
  }
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return reply({ ok: false, error: "INVALID_JSON" }, 400)
  }

  const action = String(body.action || "dry_run")

  if (action === "dry_run") {
    const dry = dryRunPayoutCorrection({
      payoutRequestId: String(body.payoutRequestId || "").trim(),
      orderId: String(body.orderId || "").trim(),
      amount: Number(body.amount ?? body.proposedDeltaSellerNet),
      settlementVerified: body.settlementVerified === true,
    })
    return reply({ ...dry, ok: dry.ok }, dry.ok ? 200 : 409)
  }

  if (action === "approve") {
    const currency = String(body.currency || "PI").toUpperCase() as "PI" | "GHC"
    const result = await recordPayoutCorrectionApproval({
      payoutRequestId: String(body.payoutRequestId || "").trim(),
      orderId: String(body.orderId || "").trim(),
      currency: currency === "GHC" ? "GHC" : "PI",
      correctionType: String(body.correctionType || "settlement_evidence_correction") as CorrectionType,
      amount: Number(body.amount),
      approvedBy: String(body.approvedBy || "operator").trim(),
      approvalRef: String(body.approvalRef || "").trim(),
      idempotencyKey: String(body.idempotencyKey || "").trim(),
    })
    return reply({ ...result, ok: result.ok !== false }, result.ok === false ? 409 : 200)
  }

  if (action === "apply") {
    const result = await applyPayoutCorrection({
      approvalId: Number(body.approvalId),
      idempotencyKey: String(body.idempotencyKey || "").trim(),
    })
    return reply({ ...result, ok: result.ok !== false }, result.ok === false ? 409 : 200)
  }

  return reply({ ok: false, error: "UNKNOWN_ACTION", allowed: ["dry_run", "approve", "apply"] }, 400)
}
