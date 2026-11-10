/**
 * Centralized ownership checks for server routes.
 * Prefer resolveAuthenticatedUser() from economy/auth for identity;
 * use these helpers to avoid duplicated IDOR branches.
 */
import { NextResponse } from "next/server"
import type { ServerAuthContext } from "@/lib/server/economy/auth"

export type AuthzFailure = {
  ok: false
  response: NextResponse
}

export type AuthzOk = { ok: true }

/**
 * Require path/body userId to match authenticated session user.
 * Returns a 403 JSON response when mismatched.
 */
export function requireSameUser(
  auth: ServerAuthContext,
  resourceUserId: string | null | undefined
): AuthzOk | AuthzFailure {
  const rid = String(resourceUserId || "").trim()
  if (!rid || rid !== auth.userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "FORBIDDEN", message: "Resource does not belong to the authenticated user" },
        { status: 403 }
      ),
    }
  }
  return { ok: true }
}

/**
 * Boolean form for domain services (no NextResponse).
 */
export function isSameUser(
  authUserId: string,
  resourceUserId: string | null | undefined
): boolean {
  const a = String(authUserId || "").trim()
  const b = String(resourceUserId || "").trim()
  return Boolean(a && b && a === b)
}
