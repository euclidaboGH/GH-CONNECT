import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { jsonErr, jsonOk } from "@/lib/server/economy/http"
import { markGhcNotificationRead } from "@/lib/server/economy/notifications"

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)
  const { id } = await ctx.params
  const ok = await markGhcNotificationRead(auth.userId, id)
  if (!ok) return jsonErr("NOT_FOUND", "Notification not found", 404)
  return jsonOk({ id, read: true })
}
