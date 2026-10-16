/**
 * GET/POST /api/economy/account — server-backed accountCreatedAt for membership trial.
 * POST may supply a one-time hint (profile.createdAt); server never moves an existing anchor.
 */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { rpcEnsureAccountCreatedAt } from "@/lib/server/economy/db"
import { isDatabaseConfigured, jsonErr, jsonOk } from "@/lib/server/economy/http"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)
  if (!isDatabaseConfigured()) {
    return jsonOk({ ok: true, mode: "local", accountCreatedAt: null })
  }
  const result = await rpcEnsureAccountCreatedAt(auth.userId)
  if (!result.ok) {
    return jsonErr("SERVER_UNAVAILABLE", result.error || "Unavailable", 503)
  }
  return jsonOk({
    ok: true,
    mode: "server",
    userId: auth.userId,
    accountCreatedAt: result.accountCreatedAt,
  })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return jsonErr("AUTH_REQUIRED", "Authentication required", 401)
  if (!isDatabaseConfigured()) {
    return jsonOk({ ok: true, mode: "local", accountCreatedAt: null })
  }
  let hint: number | undefined
  try {
    const body = await request.json()
    if (body?.accountCreatedAt != null) {
      const n = Number(body.accountCreatedAt)
      if (Number.isFinite(n) && n > 0) hint = n
    }
  } catch {
    /* optional body */
  }
  const result = await rpcEnsureAccountCreatedAt(auth.userId, hint)
  if (!result.ok) {
    return jsonErr("SERVER_UNAVAILABLE", result.error || "Unavailable", 503)
  }
  return jsonOk({
    ok: true,
    mode: "server",
    userId: auth.userId,
    accountCreatedAt: result.accountCreatedAt,
    created: result.created,
  })
}
