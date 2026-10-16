import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { cancelTransferRequest, getProcessGhcStore } from "@/lib/server/economy/store"
import { rpcCancelTransferRequest } from "@/lib/server/economy/db"
import { allowMemoryServer, isDatabaseConfigured, jsonErr, jsonOk } from "@/lib/server/economy/http"

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ requestId: string }> }
) {
  const auth = await resolveAuthenticatedUser(_request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  const { requestId } = await ctx.params
  const ref = decodeURIComponent(requestId)

  if (isDatabaseConfigured()) {
    const result = await rpcCancelTransferRequest({
      actorId: auth.userId,
      referenceId: ref,
    })
    if (!result) {
      return jsonErr("SERVER_UNAVAILABLE", "Cancel service unavailable", 503)
    }
    if (result.ok !== true) {
      return jsonErr(String(result.code || "TRANSFER_FAILED"), String(result.message || "Failed"), 400)
    }
    return jsonOk(result)
  }

  if (!allowMemoryServer()) {
    return jsonErr("SERVER_UNAVAILABLE", "Authoritative store unavailable", 503)
  }

  const result = await cancelTransferRequest(getProcessGhcStore(), {
    actorId: auth.userId,
    referenceId: ref,
  })
  if (!result.ok) {
    return jsonErr(result.code as any, result.error, 400)
  }
  return jsonOk(result)
}
