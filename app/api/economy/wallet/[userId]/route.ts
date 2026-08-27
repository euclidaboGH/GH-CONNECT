import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { getProcessGhcStore } from "@/lib/server/economy/store"
import { rpcListTransactions } from "@/lib/server/economy/db"
import {
  allowMemoryServer,
  isDatabaseConfigured,
  jsonErr,
  jsonOk,
} from "@/lib/server/economy/http"
import { computeWalletFromLedger } from "@/lib/domains/economy-ledger"
import { getServerEconomyLimits } from "@/lib/server/economy/limits"

export async function GET(
  request: Request,
  ctx: { params: Promise<{ userId: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  const { userId } = await ctx.params
  if (userId !== auth.userId) {
    return jsonErr("AUTH_REQUIRED", "You can only load your own wallet ledger", 403)
  }

  let transactions = [] as ReturnType<typeof getProcessGhcStore> extends never
    ? never
    : ReturnType<ReturnType<typeof getProcessGhcStore>["listTransactions"]>

  if (isDatabaseConfigured()) {
    const rows = await rpcListTransactions(userId)
    if (!rows) {
      return jsonErr("SERVER_UNAVAILABLE", "Failed to load wallet ledger", 503)
    }
    transactions = rows
  } else if (allowMemoryServer()) {
    transactions = getProcessGhcStore().listTransactions(userId)
  } else {
    return jsonErr("SERVER_UNAVAILABLE", "Authoritative store unavailable", 503)
  }

  const limits = getServerEconomyLimits()
  const snapshot = computeWalletFromLedger(userId, transactions, limits)

  return jsonOk({
    transactions,
    rewards: [],
    premium: null,
    transferRequests: isDatabaseConfigured()
      ? []
      : allowMemoryServer()
        ? getProcessGhcStore().listRequests(userId, "all")
        : [],
    updatedAt: Date.now(),
    snapshot,
  })
}
