import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { jsonErr, jsonOk } from "@/lib/server/economy/http"
import { markAllGhcNotificationsRead } from "@/lib/server/economy/notifications"

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)
  const n = await markAllGhcNotificationsRead(auth.userId)
  return jsonOk({ marked: n, userId: auth.userId })
}
