import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { jsonErr, jsonOk } from "@/lib/server/economy/http"
import { unreadGhcNotificationCount } from "@/lib/server/economy/notifications"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)
  const count = await unreadGhcNotificationCount(auth.userId)
  return jsonOk({ count, userId: auth.userId })
}
