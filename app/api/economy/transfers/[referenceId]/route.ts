import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { getProcessGhcStore } from "@/lib/server/economy/store"
import { rpcFindTransferByReference } from "@/lib/server/economy/db"
import {
  allowMemoryServer,
  isDatabaseConfigured,
  jsonErr,
  jsonOk,
} from "@/lib/server/economy/http"

export async function GET(
  request: Request,
  ctx: { params: Promise<{ referenceId: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  const { referenceId: raw } = await ctx.params
  // Route params are normally decoded by Next.js already; decoding again can
  // throw on malformed percent escapes. Validate before any database lookup.
  let referenceId = raw
  try {
    referenceId = decodeURIComponent(raw)
  } catch {
    return jsonErr("INVALID_REFERENCE", "Invalid transfer reference", 400)
  }
  if (
    referenceId.length < 1 ||
    referenceId.length > 128 ||
    /[\u0000-\u001f\u007f]/.test(referenceId)
  ) {
    return jsonErr("INVALID_REFERENCE", "Invalid transfer reference", 400)
  }

  let found: { debit?: { userId: string }; credit?: { userId: string } } | null = null

  if (isDatabaseConfigured()) {
    found = await rpcFindTransferByReference(referenceId)
    if (!found) return jsonErr("TRANSFER_FAILED", "Transfer not found", 404)
  } else if (allowMemoryServer()) {
    found = getProcessGhcStore().findByReference(referenceId)
    if (!found?.debit && !found?.credit) {
      return jsonErr("TRANSFER_FAILED", "Transfer not found", 404)
    }
  } else {
    return jsonErr("SERVER_UNAVAILABLE", "Authoritative store unavailable", 503)
  }

  const parties = [found.debit?.userId, found.credit?.userId].filter(Boolean)
  if (!parties.includes(auth.userId)) {
    return jsonErr("AUTH_REQUIRED", "Not authorized to view this transfer", 403)
  }

  return jsonOk({
    debit: found.debit,
    credit: found.credit,
    debitTx: found.debit,
    creditTx: found.credit,
    referenceId,
  })
}
