import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { acceptTransferRequest, getProcessGhcStore } from "@/lib/server/economy/store"
import { rpcAcceptTransferRequest } from "@/lib/server/economy/db"
import { allowMemoryServer, isDatabaseConfigured, jsonErr, jsonOk } from "@/lib/server/economy/http"
import { mapTransferFailure } from "@/lib/domains/economy-transfer-contract"

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ requestId: string }> }
) {
  const auth = await resolveAuthenticatedUser(_request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  const { requestId } = await ctx.params
  const ref = decodeURIComponent(requestId)

  if (isDatabaseConfigured()) {
    const result = await rpcAcceptTransferRequest({
      actorId: auth.userId,
      referenceId: ref,
    })
    if (!result) {
      return jsonErr("SERVER_UNAVAILABLE", "Accept service unavailable", 503)
    }
    if (result.ok !== true) {
      const code = String(result.code || "TRANSFER_FAILED")
      const mapped = mapTransferFailure(String(result.message || code), code as any)
      const status =
        code === "AUTH_REQUIRED" || code === "REQUEST_NOT_AUTHORIZED"
          ? 403
          : code === "INSUFFICIENT_BALANCE"
            ? 402
            : code === "SERVER_UNAVAILABLE"
              ? 503
              : 400
      return jsonErr(mapped.code, mapped.message, status)
    }
    return jsonOk(result)
  }

  if (!allowMemoryServer()) {
    return jsonErr("SERVER_UNAVAILABLE", "Authoritative store unavailable", 503)
  }

  const result = await acceptTransferRequest(getProcessGhcStore(), {
    actorId: auth.userId,
    referenceId: ref,
  })
  if (!result.ok) {
    return jsonErr(result.error.code as any, result.error.message, 400)
  }
  return jsonOk(result)
}
