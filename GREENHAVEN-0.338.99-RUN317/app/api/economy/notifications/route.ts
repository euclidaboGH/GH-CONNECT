import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { jsonErr, jsonOk } from "@/lib/server/economy/http"
import { listGhcNotifications } from "@/lib/server/economy/notifications"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)

  const url = new URL(request.url)
  // Ignore client-supplied userId — always use authenticated identity
  const _ignored = url.searchParams.get("userId")
  void _ignored

  const limit = Number(url.searchParams.get("limit") || "50")
  const unreadOnly = url.searchParams.get("unreadOnly") === "1"

  const items = await listGhcNotifications(auth.userId, {
    limit: Number.isFinite(limit) ? limit : 50,
    unreadOnly,
  })

  return jsonOk({ items, userId: auth.userId })
}
