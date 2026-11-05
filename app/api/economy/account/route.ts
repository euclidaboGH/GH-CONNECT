/**
 * GET/POST /api/economy/account — server-backed accountCreatedAt for membership trial.
 * POST may supply a one-time hint (profile.createdAt); server never moves an existing anchor.
 */
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { rpcEnsureAccountCreatedAt } from "@/lib/server/economy/db"
import { isDatabaseConfigured, jsonErr, jsonOk } from "@/lib/server/economy/http"

import { readBoundedJson } from "@/lib/server/http/read-bounded-json"

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
  const parsedBody = await readBoundedJson(request, 4 * 1024)
  if (parsedBody.ok && parsedBody.value.accountCreatedAt != null) {
    const n = Number(parsedBody.value.accountCreatedAt)
    if (Number.isFinite(n) && n > 0) hint = n
  } else if (!parsedBody.ok && parsedBody.error !== "INVALID_BODY") {
    return jsonErr(parsedBody.error, "Invalid request body", parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400)
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
