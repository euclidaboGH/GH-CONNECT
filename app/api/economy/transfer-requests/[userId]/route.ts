import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { getProcessGhcStore } from "@/lib/server/economy/store"
import { rpcListTransferRequests } from "@/lib/server/economy/db"
import { allowMemoryServer, isDatabaseConfigured, jsonErr, jsonOk } from "@/lib/server/economy/http"

export async function GET(
  request: Request,
  ctx: { params: Promise<{ userId: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  const { userId } = await ctx.params
  // Ignore path userId unless it matches auth — never list another user
  if (userId !== auth.userId) {
    return jsonErr("AUTH_REQUIRED", "Not authorized", 403)
  }

  const url = new URL(request.url)
  const direction = (url.searchParams.get("direction") || "all") as
    | "incoming"
    | "outgoing"
    | "all"

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
