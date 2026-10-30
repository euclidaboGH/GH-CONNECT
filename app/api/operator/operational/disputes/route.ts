import { NextResponse } from "next/server"
import { assertOperatorKey } from "@/lib/server/marketplace/operational-rpc"
import {
  applyDisputeAdjustment,
  recordDisputeDecision,
  type DisputeDecisionKind,
} from "@/lib/server/marketplace/operational-disputes"

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

  const action = String(body.action || "decide")
  if (action === "decide") {
    const decision = String(body.decision || "") as DisputeDecisionKind
    const currency = String(body.currency || "PI").toUpperCase() as "PI" | "GHC"
    const result = await recordDisputeDecision({
      orderId: String(body.orderId || "").trim(),
      caseRef: String(body.caseRef || "").trim(),
      decision,
      reasonCode: String(body.reasonCode || body.reason || "").trim(),
      approvalRef: String(body.approvalRef || "").trim(),
      actorId: String(body.actorId || body.decidedBy || "operator").trim(),
      currency: currency === "GHC" ? "GHC" : "PI",
      buyerAmount: Number(body.buyerAmount || 0),
      sellerNetReduction: Number(body.sellerNetReduction || 0),
      idempotencyKey: String(body.idempotencyKey || "").trim(),
    })
    return reply({ ...result, ok: result.ok !== false }, result.ok === false ? 409 : 200)
  }

  if (action === "apply_adjustment") {
    const result = await applyDisputeAdjustment({
      orderId: String(body.orderId || "").trim(),
      decisionId: Number(body.decisionId),
      grossAmount: Number(body.grossAmount),
      sellerNetReduction: Number(body.sellerNetReduction),
      idempotencyKey: String(body.idempotencyKey || "").trim(),
    })
    return reply({ ...result, ok: result.ok !== false }, result.ok === false ? 409 : 200)
  }

  return reply({ ok: false, error: "UNKNOWN_ACTION" }, 400)
}
