/**
 * Operator: refund request + provider-confirmed outcome recording.
 * Requires x-ghc-operator-key. Never marks confirmed without explicit providerStatus.
 */
import { NextResponse } from "next/server"
import { assertOperatorKey } from "@/lib/server/marketplace/operational-rpc"
import {
  beginRefundRequest,
  recordProviderConfirmedRefund,
} from "@/lib/server/marketplace/operational-refunds"

import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

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
  const parsedBody = await readBoundedJson(request, 32 * 1024)
  if (!parsedBody.ok) return reply({ ok: false, error: parsedBody.error }, parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const body = parsedBody.value

  const action = String(body.action || "")
  const orderId = String(body.orderId || "").trim()
  const provider = String(body.provider || "").trim() as "pi" | "ghc"
  const providerPaymentRef = String(body.providerPaymentRef || "").trim()
  const grossAmount = Number(body.grossAmount)
  const sellerNetReduction = Number(body.sellerNetReduction)
  const idempotencyKey = String(body.idempotencyKey || "").trim()

  if (!orderId || !["pi", "ghc"].includes(provider) || !idempotencyKey) {
    return reply({ ok: false, error: "INVALID_INPUT" }, 400)
  }

  if (action === "request") {
    const result = await beginRefundRequest({
      orderId,
      provider,
      providerPaymentRef,
      grossAmount,
      sellerNetReduction,
      idempotencyKey,
      actorId: String(body.actorId || "operator"),
      metadata: typeof body.metadata === "object" && body.metadata ? (body.metadata as Record<string, unknown>) : {},
    })
    return reply({ ...result, ok: result.ok !== false }, result.ok === false ? 409 : 200)
  }

  if (action === "confirm" || action === "fail") {
    const providerRefundId = String(body.providerRefundId || "").trim()
    if (!providerRefundId || !providerPaymentRef) {
      return reply({ ok: false, error: "PROVIDER_REFS_REQUIRED" }, 400)
    }
    const result = await recordProviderConfirmedRefund({
      orderId,
      provider,
      providerRefundId,
      providerPaymentRef,
      grossAmount,
      sellerNetReduction,
      providerStatus: action === "confirm" ? "confirmed" : "failed",
      idempotencyKey,
      providerRawEvidence:
        typeof body.providerEvidence === "object" && body.providerEvidence
          ? (body.providerEvidence as Record<string, unknown>)
          : undefined,
    })
    return reply({ ...result, ok: result.ok !== false }, result.ok === false ? 409 : 200)
  }

  return reply({ ok: false, error: "UNKNOWN_ACTION", allowed: ["request", "confirm", "fail"] }, 400)
}
