import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { jsonErr, jsonOk } from "@/lib/server/economy/http"
import { markAllGhcNotificationsRead } from "@/lib/server/economy/notifications"
import { enforceUserMutationRateLimit } from "@/lib/server/security/user-rate-limit"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)
  const __rateLimited = await enforceUserMutationRateLimit(auth.userId, "economy/notifications/read-all:POST", 60, 60_000, { failClosed: false })
  if (__rateLimited) return __rateLimited
  const n = await markAllGhcNotificationsRead(auth.userId)
  return jsonOk({ marked: n, userId: auth.userId })
}
