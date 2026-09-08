/**
 * Server-side step-up authentication (Phase 4).
 *
 * Proves recent Pi re-authentication bound to a specific GH server session.
 * Never stores Pi access tokens, PINs, or secrets.
 * App Lock unlock does NOT create step-up.
 */

import { randomBytes } from "crypto"
import { readGhcServerEnv, hasPrivilegedDatabase } from "@/lib/server/economy/env"
import type { ServerAuthContext } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"

/** High-risk operations: 5 minutes */
export const STEP_UP_TTL_MS = 5 * 60 * 1000

export type StepUpRecord = {
  id: string
  ghUserId: string
  sessionId: string
  authMethod: string
  authenticatedAt: number
  expiresAt: number
  revokedAt: number | null
}

// Memory fallback
const memBySession = new Map<string, StepUpRecord>() // key: `${userId}:${sessionId}` → latest

function now() {
  return Date.now()
}

function sessionKey(ghUserId: string, sessionId: string) {
  return `${ghUserId}:${sessionId}`
}

function dbConfigured() {
  return hasPrivilegedDatabase()
}

function newId() {
  return randomBytes(16).toString("hex")
}

type DbRow = {
  id: string
  gh_user_id: string
  session_id: string
  auth_method: string
  authenticated_at: string
  expires_at: string
  revoked_at: string | null
}

function rowToRecord(row: DbRow): StepUpRecord {
  return {
    id: String(row.id),
    ghUserId: String(row.gh_user_id),
    sessionId: String(row.session_id),
    authMethod: String(row.auth_method || "pi_fresh_auth"),
    authenticatedAt: Date.parse(row.authenticated_at) || now(),
    expiresAt: Date.parse(row.expires_at) || now(),
    revokedAt: row.revoked_at ? Date.parse(row.revoked_at) || now() : null,
  }
}

function isValid(rec: StepUpRecord, at: number = now()): boolean {
  if (rec.revokedAt != null) return false
  if (at >= rec.expiresAt) return false
  return true
}

async function dbInsert(rec: StepUpRecord): Promise<boolean> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return false
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_step_ups`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          id: rec.id,
          gh_user_id: rec.ghUserId,
          session_id: rec.sessionId,
          auth_method: rec.authMethod,
          authenticated_at: new Date(rec.authenticatedAt).toISOString(),
          expires_at: new Date(rec.expiresAt).toISOString(),
          revoked_at: null,
        }),
        cache: "no-store",
      }
    )
    if (!res.ok) {
      console.error("[step-up] dbInsert failed", res.status)
      return false
    }
    return true
  } catch (err) {
    console.error("[step-up] dbInsert error", err instanceof Error ? err.message : "unknown")
    return false
  }
}

async function dbFindValid(
  ghUserId: string,
  sessionId: string
): Promise<StepUpRecord | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const q = new URLSearchParams({
      gh_user_id: `eq.${ghUserId}`,
      session_id: `eq.${sessionId}`,
      revoked_at: "is.null",
      expires_at: `gt.${new Date().toISOString()}`,
      order: "authenticated_at.desc",
      limit: "1",
      select: "*",
    })
    // PostgREST filter syntax
    const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_step_ups?gh_user_id=eq.${encodeURIComponent(ghUserId)}&session_id=eq.${encodeURIComponent(sessionId)}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&order=authenticated_at.desc&limit=1&select=*`
    const res = await fetch(url, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    })
    if (!res.ok) return null
    const rows = (await res.json()) as DbRow[]
    if (!Array.isArray(rows) || !rows[0]) return null
    const rec = rowToRecord(rows[0])
    return isValid(rec) ? rec : null
  } catch {
    return null
  }
}

async function dbRevokeForSession(sessionId: string): Promise<void> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return
  try {
    const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_step_ups?session_id=eq.${encodeURIComponent(sessionId)}&revoked_at=is.null`
    await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
      cache: "no-store",
    })
  } catch {
    /* */
  }
}

/**
 * Create step-up after successful fresh Pi /me for the current session.
 */
export async function createStepUp(input: {
  ghUserId: string
  sessionId: string
  authMethod?: string
}): Promise<StepUpRecord> {
  const ghUserId = String(input.ghUserId || "").trim()
  const sessionId = String(input.sessionId || "").trim()
  if (!ghUserId || !sessionId) throw new Error("ghUserId and sessionId required")

  const t = now()
  const rec: StepUpRecord = {
    id: newId(),
    ghUserId,
    sessionId,
    authMethod: input.authMethod || "pi_fresh_auth",
    authenticatedAt: t,
    expiresAt: t + STEP_UP_TTL_MS,
    revokedAt: null,
  }

  if (dbConfigured()) {
    await dbInsert(rec)
  }
  memBySession.set(sessionKey(ghUserId, sessionId), rec)
  console.info("[step-up] STEP_UP_SUCCESS", { userId: ghUserId, sessionId: sessionId.slice(0, 8) })
  return rec
}

/**
 * Find valid (non-revoked, non-expired) step-up for user+session.
 */
export async function findValidStepUp(
  ghUserId: string,
  sessionId: string
): Promise<StepUpRecord | null> {
  const key = sessionKey(ghUserId, sessionId)
  const mem = memBySession.get(key)
  if (mem && isValid(mem)) return mem
  if (mem && !isValid(mem)) memBySession.delete(key)

  if (dbConfigured()) {
    const fromDb = await dbFindValid(ghUserId, sessionId)
    if (fromDb) {
      memBySession.set(key, fromDb)
      return fromDb
    }
  }
  return null
}

/** Revoke all step-ups for a session (logout / session revoke) */
export async function revokeStepUpsForSession(sessionId: string): Promise<void> {
  const sid = String(sessionId || "").trim()
  if (!sid) return
  for (const [k, rec] of memBySession) {
    if (rec.sessionId === sid && rec.revokedAt == null) {
      memBySession.set(k, { ...rec, revokedAt: now() })
    }
  }
  if (dbConfigured()) await dbRevokeForSession(sid)
  console.info("[step-up] SESSION_STEP_UP_REVOKED", { sessionId: sid.slice(0, 8) })
}

/**
 * Require recent server-side step-up for sensitive operations.
 * Returns null if ok, or error payload if rejected.
 */
export async function requireRecentStepUp(
  auth: ServerAuthContext
): Promise<
  | null
  | {
      code:
        | "STEP_UP_REQUIRED"
        | "STEP_UP_EXPIRED"
        | "SESSION_REQUIRED"
        | "AUTH_REQUIRED"
      message: string
      status: number
    }
> {
  if (!auth?.userId) {
    return {
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      status: 401,
    }
  }

  // Step-up is bound to GH server session — require session source
  if (auth.source !== "gh_session" || !auth.sessionId) {
    console.info("[step-up] SENSITIVE_OPERATION_REJECTED_STEP_UP", {
      reason: "no_gh_session",
      source: auth.source,
    })
    return {
      code: "SESSION_REQUIRED",
      message:
        "A GreenHaven server session is required for this action. Sign in via Pi Browser.",
      status: 403,
    }
  }

  const step = await findValidStepUp(auth.userId, auth.sessionId)
  if (!step) {
    console.info("[step-up] SENSITIVE_OPERATION_REJECTED_STEP_UP", {
      userId: auth.userId,
      sessionId: auth.sessionId.slice(0, 8),
    })
    return {
      code: "STEP_UP_REQUIRED",
      message:
        "Recent re-authentication required. Confirm with Pi Network and try again.",
      status: 403,
    }
  }

  return null
}

/** Rate-limit step-up establishment attempts */
export function rateLimitStepUp(userId: string): { ok: boolean; retryAfterSec?: number } {
  return checkRateLimit(`step_up:${userId}`, 10, 60_000)
}

export function _resetStepUpStoreForTests() {
  memBySession.clear()
}
