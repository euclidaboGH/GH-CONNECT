import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { createTransferRequest, getProcessGhcStore } from "@/lib/server/economy/store"
import { rpcCreateTransferRequest } from "@/lib/server/economy/db"
import { allowMemoryServer, isDatabaseConfigured, jsonErr, jsonOk } from "@/lib/server/economy/http"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonErr("TRANSFER_FAILED", "Invalid JSON", 400)
  }

  const payerId = String(body.fromUserId || body.payerId || "").trim()
  const amount = Number(body.amount)
  const referenceId = String(body.referenceId || "").trim()
  const note = body.note != null ? String(body.note) : undefined

  if (!payerId) return jsonErr("INVALID_RECIPIENT", "Payer required", 400)
  if (!referenceId) return jsonErr("TRANSFER_FAILED", "referenceId required", 400)
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonErr("INVALID_AMOUNT", "Invalid amount", 400)
  }

  // requester ALWAYS from session
  if (isDatabaseConfigured()) {
    const result = await rpcCreateTransferRequest({
      requesterId: auth.userId,
      payerId,
      amount,
      referenceId,
      note,
    })
    if (!result) {
      return jsonErr("SERVER_UNAVAILABLE", "Request service unavailable", 503)
    }
    if (result.ok !== true) {
      return jsonErr(String(result.code || "TRANSFER_FAILED"), String(result.message || "Failed"), 400)
    }
    return jsonOk({ ok: true, request: result.request, idempotent: result.idempotent })
  }

  if (!allowMemoryServer()) {
    return jsonErr("SERVER_UNAVAILABLE", "Authoritative store unavailable", 503)
  }

  const result = await createTransferRequest(getProcessGhcStore(), {
    requesterId: auth.userId,
    payerId,
    amount,
    referenceId,
    note,
  })

  if (!result.ok) {
    return jsonErr(result.code as any, result.error, 400)
  }
  return jsonOk({ ok: true, request: result.request })
}
