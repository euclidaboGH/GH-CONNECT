import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { createTransferRequest, getProcessGhcStore } from "@/lib/server/economy/store"
import { rpcCreateTransferRequest, rpcListTransferRequests } from "@/lib/server/economy/db"
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
  const referenceId = String(body.referenceId || "").trim()
  const note = body.note != null ? String(body.note) : undefined

  // Ignore client-forged identity / balance fields
  void body.requesterId
  void body.userId
  void body.balance

  if (!payerId) return jsonErr("INVALID_RECIPIENT", "Payer required", 400)
  if (payerId === auth.userId) {
    return jsonErr("SELF_TRANSFER", "Cannot request GHC from yourself", 400)
  }
  if (!referenceId) return jsonErr("TRANSFER_FAILED", "referenceId required", 400)

  const { validatePositiveGhcAmount } = await import("@/lib/server/economy/amount")
  const amt = validatePositiveGhcAmount(body.amount, { max: 5_000 })
  if (!amt.ok) {
    return jsonErr(amt.code, amt.message, 400)
  }
  const amount = amt.amount

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
    return jsonErr(String(result.code || "TRANSFER_FAILED"), String(result.error || "Failed"), 400)
  }
  return jsonOk({ ok: true, request: result.request })
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  const url = new URL(request.url)
  const direction = (url.searchParams.get("direction") || "all") as
    | "incoming"
    | "outgoing"
    | "all"

  // Always scope to authenticated user — never trust a client-supplied userId path param
  if (isDatabaseConfigured()) {
    const rows = await rpcListTransferRequests(auth.userId, direction)
    if (!rows) {
      return jsonErr("SERVER_UNAVAILABLE", "List service unavailable", 503)
    }
    const requests = rows.map((r) => ({
      id: String(r.id),
      referenceId: String(r.reference_id),
      requesterId: String(r.requester_id),
      payerId: String(r.payer_id),
      amount: Number(r.amount),
      status: String(r.status),
      note: r.note != null ? String(r.note) : undefined,
      createdAt: r.created_at ? new Date(String(r.created_at)).getTime() : Date.now(),
      expiresAt: r.expires_at ? new Date(String(r.expires_at)).getTime() : undefined,
      direction:
        String(r.payer_id) === auth.userId
          ? "incoming"
          : String(r.requester_id) === auth.userId
            ? "outgoing"
            : "all",
    }))
    return jsonOk({ requests })
  }

  if (!allowMemoryServer()) {
    return jsonErr("SERVER_UNAVAILABLE", "Authoritative store unavailable", 503)
  }

  const requests = getProcessGhcStore().listRequests(auth.userId, direction)
  return jsonOk({ requests })
}

