/**
 * Phase 4 — Identity & Authentication integrity helpers.
 *
 * Centralizes session-grade authorization for sensitive routes.
 * Prefer gh_session over bootstrap Pi bearer for account management,
 * session list, and step-up bound actions.
 */

import { NextResponse } from "next/server"
import type { ServerAuthContext } from "@/lib/server/economy/auth"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { isSessionStoreDurable } from "@/lib/server/identity/session-store"

export type AuthIntegrityFailure = {
  ok: false
  response: NextResponse
}

export type AuthIntegrityOk = {
  ok: true
  auth: ServerAuthContext & { source: "gh_session"; sessionId: string }
}

function noStoreJson(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  })
}

/**
 * Require a durable GreenHaven server session (not Pi bearer bootstrap alone).
 * Use for device session management, account security, and step-up surfaces.
 */
export async function requireGhSession(
  headers: Headers
): Promise<AuthIntegrityOk | AuthIntegrityFailure> {
  const auth = await resolveAuthenticatedUser(headers)
  if (!auth) {
    return {
      ok: false,
      response: noStoreJson({ ok: false, error: "AUTH_REQUIRED" }, 401),
    }
  }
  if (auth.source !== "gh_session" || !auth.sessionId) {
    return {
      ok: false,
      response: noStoreJson(
        {
          ok: false,
          error: "SESSION_REQUIRED",
          message:
            "This action requires a GreenHaven server session. Complete Pi sign-in so a durable session can be issued.",
        },
        403
      ),
    }
  }
  return {
    ok: true,
    auth: auth as ServerAuthContext & { source: "gh_session"; sessionId: string },
  }
}

/**
 * Production-like environments must not accept account security actions
 * when the session store is only process-memory (cross-instance invalid).
 */
export function requireDurableSessionStore(): AuthIntegrityFailure | { ok: true } {
  const isProd =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.GHC_ENV === "production"
  if (isProd && !isSessionStoreDurable()) {
    return {
      ok: false,
      response: noStoreJson(
        {
          ok: false,
          error: "SESSION_DURABILITY_UNAVAILABLE",
          message: "Account security requires a durable session store.",
        },
        503
      ),
    }
  }
  return { ok: true }
}

/**
 * Combined gate for session management and account security endpoints.
 */
export async function requireAccountSecurityContext(
  headers: Headers
): Promise<AuthIntegrityOk | AuthIntegrityFailure> {
  const durable = requireDurableSessionStore()
  if (!durable.ok) return durable
  return requireGhSession(headers)
}

export const AUTH_INTEGRITY_PHASE = "4-identity-authentication" as const
