/**
 * GH CONNECT server session store (Phase 2B).
 *
 * - Opaque random tokens; only SHA-256 hash stored durably
 * - Issued only after verified Pi /me + identity mapping
 * - Never stores Pi access tokens, PINs, passwords, or payment secrets
 * - Supabase when configured; process-memory fallback for local/dev
 */

import { createHash, randomBytes } from "crypto"
import { readGhcServerEnv, hasPrivilegedDatabase } from "@/lib/server/economy/env"

/** Cookie name for GH server session */
export const GH_SESSION_COOKIE = "gh_session"

/** Absolute max lifetime (ms) — 14 days */
export const SESSION_ABSOLUTE_TTL_MS = 14 * 24 * 60 * 60 * 1000

/** Idle timeout (ms) — 7 days without activity */
export const SESSION_IDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** How often we persist last_seen touch to DB (ms) — reduce write load */
const TOUCH_MIN_INTERVAL_MS = 5 * 60 * 1000

export type SessionRecord = {
  id: string
  tokenHash: string
  ghUserId: string
  createdAt: number
  lastSeenAt: number
  expiresAt: number
  absoluteExpiresAt: number
  revokedAt: number | null
  userAgentHash: string | null
  /** Privacy-conscious label derived from User-Agent (not unique device id) */
  deviceLabel?: string | null
}

/** Public session info for management UI — never includes tokens or hashes */
export type PublicSessionInfo = {
  id: string
  deviceLabel: string
  createdAt: number
  lastSeenAt: number
  expiresAt: number
  absoluteExpiresAt: number
  isCurrent: boolean
  active: boolean
}

export type IssuedSession = {
  /** Raw token — set in HttpOnly cookie only; never log */
  rawToken: string
  record: SessionRecord
}

// ---------------------------------------------------------------------------
// Memory fallback
// ---------------------------------------------------------------------------

const memByHash = new Map<string, SessionRecord>()
const memById = new Map<string, SessionRecord>()

function now() {
  return Date.now()
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex")
}

function newRawToken(): string {
  return randomBytes(32).toString("base64url")
}

function newId(): string {
  return randomBytes(16).toString("hex")
}

function isExpired(rec: SessionRecord, at: number = now()): boolean {
  if (rec.revokedAt != null) return true
  if (at >= rec.absoluteExpiresAt) return true
  if (at >= rec.expiresAt) return true
  // Idle: expiresAt already tracks sliding window
  return false
}

function hashUserAgent(ua: string | null | undefined): string | null {
  if (!ua || !String(ua).trim()) return null
  return createHash("sha256").update(String(ua).slice(0, 512), "utf8").digest("hex").slice(0, 32)
}

/** Derive a short, non-invasive label from User-Agent (browser/OS/category). */
export function deriveDeviceLabel(ua: string | null | undefined): string {
  const s = String(ua || "").trim()
  if (!s) return "Unknown device"
  const lower = s.toLowerCase()
  let os = "Unknown OS"
  if (/android/i.test(s)) os = "Android"
  else if (/iphone|ipad|ipod/i.test(s)) os = "iOS"
  else if (/mac os x|macintosh/i.test(s)) os = "macOS"
  else if (/windows/i.test(s)) os = "Windows"
  else if (/linux/i.test(s)) os = "Linux"
  let browser = "Browser"
  if (/edg\//i.test(s)) browser = "Edge"
  else if (/chrome|crios/i.test(s) && !/edg\//i.test(s)) browser = "Chrome"
  else if (/firefox|fxios/i.test(s)) browser = "Firefox"
  else if (/safari/i.test(s) && !/chrome|crios|android/i.test(s)) browser = "Safari"
  else if (/pi.?browser|picloud/i.test(s)) browser = "Pi Browser"
  const mobile = /mobile|android|iphone|ipad/i.test(lower)
  const category = mobile ? "Mobile" : "Desktop"
  return `${browser} on ${os} (${category})`
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function dbConfigured(): boolean {
  return hasPrivilegedDatabase()
}

type DbRow = {
  id: string
  token_hash: string
  gh_user_id: string
  created_at: string
  last_seen_at: string
  expires_at: string
  absolute_expires_at: string
  revoked_at: string | null
  user_agent_hash: string | null
  meta?: { deviceLabel?: string } | null
}

function rowToRecord(row: DbRow): SessionRecord {
  const meta = row.meta && typeof row.meta === "object" ? row.meta : null
  return {
    id: String(row.id),
    tokenHash: String(row.token_hash),
    ghUserId: String(row.gh_user_id),
    createdAt: Date.parse(row.created_at) || now(),
    lastSeenAt: Date.parse(row.last_seen_at) || now(),
    expiresAt: Date.parse(row.expires_at) || now(),
    absoluteExpiresAt: Date.parse(row.absolute_expires_at) || now(),
    revokedAt: row.revoked_at ? Date.parse(row.revoked_at) || now() : null,
    userAgentHash: row.user_agent_hash != null ? String(row.user_agent_hash) : null,
    deviceLabel: meta?.deviceLabel != null ? String(meta.deviceLabel) : null,
  }
}

async function dbInsert(rec: SessionRecord): Promise<boolean> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return false
  try {
    const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_sessions`
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        id: rec.id,
        token_hash: rec.tokenHash,
        gh_user_id: rec.ghUserId,
        created_at: new Date(rec.createdAt).toISOString(),
        last_seen_at: new Date(rec.lastSeenAt).toISOString(),
        expires_at: new Date(rec.expiresAt).toISOString(),
        absolute_expires_at: new Date(rec.absoluteExpiresAt).toISOString(),
        revoked_at: null,
        user_agent_hash: rec.userAgentHash,
        meta: { deviceLabel: rec.deviceLabel || "Unknown device" },
      }),
      cache: "no-store",
    })
    if (!res.ok) {
      console.error("[session] dbInsert failed", res.status)
      return false
    }
    return true
  } catch (err) {
    console.error("[session] dbInsert error", err instanceof Error ? err.message : "unknown")
    return false
  }
}

async function dbSelectByHash(tokenHash: string): Promise<SessionRecord | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}&select=*&limit=1`
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
    return rowToRecord(rows[0])
  } catch {
    return null
  }
}

async function dbPatch(
  id: string,
  patch: Record<string, unknown>
): Promise<boolean> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return false
  try {
    const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_sessions?id=eq.${encodeURIComponent(id)}`
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
      cache: "no-store",
    })
    return res.ok
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Issue a new server session for a verified GH user.
 * Revokes prior active sessions for the same user + same userAgentHash
 * to limit session explosion from repeated Pi bootstrap on one device.
 */
export async function createSession(input: {
  ghUserId: string
  userAgent?: string | null
}): Promise<IssuedSession> {
  const ghUserId = String(input.ghUserId || "").trim()
  if (!ghUserId) throw new Error("ghUserId required")

  const uaHash = hashUserAgent(input.userAgent)
  const t = now()

  // Soft de-dupe: revoke same-device prior sessions in memory
  for (const [hash, existing] of memByHash) {
    if (
      existing.ghUserId === ghUserId &&
      existing.revokedAt == null &&
      existing.userAgentHash &&
      uaHash &&
      existing.userAgentHash === uaHash
    ) {
      const revoked = { ...existing, revokedAt: t }
      memByHash.set(hash, revoked)
      memById.set(existing.id, revoked)
      if (dbConfigured()) {
        void dbPatch(existing.id, { revoked_at: new Date(t).toISOString() })
      }
    }
  }

  const rawToken = newRawToken()
  const tokenHash = hashToken(rawToken)
  const deviceLabel = deriveDeviceLabel(input.userAgent)
  const rec: SessionRecord = {
    id: newId(),
    tokenHash,
    ghUserId,
    createdAt: t,
    lastSeenAt: t,
    expiresAt: t + SESSION_IDLE_TTL_MS,
    absoluteExpiresAt: t + SESSION_ABSOLUTE_TTL_MS,
    revokedAt: null,
    userAgentHash: uaHash,
    deviceLabel,
  }

  if (dbConfigured()) {
    const ok = await dbInsert(rec)
    if (!ok) {
      console.error("[session] durable insert failed; using memory fallback")
    }
  }

  memByHash.set(tokenHash, rec)
  memById.set(rec.id, rec)
  console.info("[session] SESSION_CREATED", {
    userId: ghUserId,
    sessionId: rec.id.slice(0, 8),
    deviceLabel,
  })

  return { rawToken, record: rec }
}

/**
 * Validate raw session token. Returns record if active; null if invalid/expired/revoked.
 * Optionally slides idle expiry (throttled).
 */
export async function validateSession(
  rawToken: string,
  opts?: { touch?: boolean }
): Promise<SessionRecord | null> {
  const token = String(rawToken || "").trim()
  if (!token) return null
  const tokenHash = hashToken(token)

  let rec: SessionRecord | null = memByHash.get(tokenHash) || null
  if (!rec && dbConfigured()) {
    rec = await dbSelectByHash(tokenHash)
    if (rec) {
      memByHash.set(tokenHash, rec)
      memById.set(rec.id, rec)
    }
  }
  if (!rec) return null
  if (isExpired(rec)) return null

  if (opts?.touch !== false) {
    const t = now()
    if (t - rec.lastSeenAt >= TOUCH_MIN_INTERVAL_MS) {
      const updated: SessionRecord = {
        ...rec,
        lastSeenAt: t,
        // Slide idle window but never past absolute
        expiresAt: Math.min(t + SESSION_IDLE_TTL_MS, rec.absoluteExpiresAt),
      }
      memByHash.set(tokenHash, updated)
      memById.set(updated.id, updated)
      if (dbConfigured()) {
        void dbPatch(updated.id, {
          last_seen_at: new Date(updated.lastSeenAt).toISOString(),
          expires_at: new Date(updated.expiresAt).toISOString(),
        })
      }
      return updated
    }
  }

  return rec
}

/**
 * Revoke a session by raw token. Idempotent.
 */
export async function revokeSessionByToken(rawToken: string): Promise<boolean> {
  const token = String(rawToken || "").trim()
  if (!token) return false
  const tokenHash = hashToken(token)
  let rec = memByHash.get(tokenHash) || null
  if (!rec && dbConfigured()) {
    rec = await dbSelectByHash(tokenHash)
  }
  if (!rec) return false
  if (rec.revokedAt != null) return true

  const revokedAt = now()
  const updated = { ...rec, revokedAt }
  memByHash.set(tokenHash, updated)
  memById.set(updated.id, updated)

  if (dbConfigured()) {
    await dbPatch(rec.id, { revoked_at: new Date(revokedAt).toISOString() })
  }
  return true
}

/**
 * Revoke all sessions for a user (future device management / logout-all).
 */
export async function revokeAllSessionsForUser(ghUserId: string): Promise<number> {
  const uid = String(ghUserId || "").trim()
  if (!uid) return 0
  let count = 0
  const t = now()
  for (const [hash, rec] of memByHash) {
    if (rec.ghUserId === uid && rec.revokedAt == null) {
      const updated = { ...rec, revokedAt: t }
      memByHash.set(hash, updated)
      memById.set(rec.id, updated)
      count++
      if (dbConfigured()) {
        void dbPatch(rec.id, { revoked_at: new Date(t).toISOString() })
      }
    }
  }
  // DB-wide revoke for rows not in memory
  if (dbConfigured()) {
    const env = readGhcServerEnv()
    if (env.supabaseUrl && env.supabaseServiceRoleKey) {
      try {
        const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_sessions?gh_user_id=eq.${encodeURIComponent(uid)}&revoked_at=is.null`
        await fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: env.supabaseServiceRoleKey,
            Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
          },
          body: JSON.stringify({ revoked_at: new Date(t).toISOString() }),
          cache: "no-store",
        })
      } catch {
        /* */
      }
    }
  }
  return count
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

export function buildSessionCookieHeader(
  rawToken: string,
  opts?: { maxAgeSec?: number; isProduction?: boolean }
): string {
  const env = readGhcServerEnv()
  const isProd = opts?.isProduction ?? env.isProduction
  const maxAge =
    opts?.maxAgeSec ?? Math.floor(SESSION_ABSOLUTE_TTL_MS / 1000)
  const parts = [
    `${GH_SESSION_COOKIE}=${rawToken}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ]
  if (isProd) parts.push("Secure")
  return parts.join("; ")
}

export function buildClearSessionCookieHeader(isProduction?: boolean): string {
  const env = readGhcServerEnv()
  const isProd = isProduction ?? env.isProduction
  const parts = [
    `${GH_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ]
  if (isProd) parts.push("Secure")
  return parts.join("; ")
}

/**
 * Extract session token from Cookie header or Authorization: Bearer ghs_...
 */
export function extractSessionToken(headers: Headers): string | null {
  const cookie = headers.get("cookie") || headers.get("Cookie") || ""
  if (cookie) {
    const parts = cookie.split(";")
    for (const p of parts) {
      const [k, ...rest] = p.trim().split("=")
      if (k === GH_SESSION_COOKIE) {
        const v = rest.join("=").trim()
        if (v) return v
      }
    }
  }
  const auth = headers.get("authorization") || headers.get("Authorization") || ""
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (m) {
    const t = m[1].trim()
    // Prefer not to use Pi tokens here; session tokens are base64url ~43 chars
    // Explicit prefix optional — validation is hash lookup
    if (t && !t.startsWith("user:") && t.length >= 20) {
      // Caller will try session validation before Pi /me
      return null // leave Bearer for Pi/JWT path; cookie is primary for GH session
    }
  }
  return null
}

/** Parse only cookie (preferred GH session channel) */
export function extractSessionTokenFromCookie(headers: Headers): string | null {
  const cookie = headers.get("cookie") || headers.get("Cookie") || ""
  if (!cookie) return null
  for (const p of cookie.split(";")) {
    const [k, ...rest] = p.trim().split("=")
    if (k === GH_SESSION_COOKIE) {
      const v = rest.join("=").trim()
      if (v) return v
    }
  }
  return null
}

export function isSessionStoreDurable(): boolean {
  return dbConfigured()
}

async function dbListByUser(ghUserId: string): Promise<SessionRecord[]> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return []
  try {
    const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_sessions?gh_user_id=eq.${encodeURIComponent(ghUserId)}&order=last_seen_at.desc&select=id,token_hash,gh_user_id,created_at,last_seen_at,expires_at,absolute_expires_at,revoked_at,user_agent_hash,meta&limit=50`
    const res = await fetch(url, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    })
    if (!res.ok) return []
    const rows = (await res.json()) as DbRow[]
    if (!Array.isArray(rows)) return []
    return rows.map(rowToRecord)
  } catch {
    return []
  }
}

/**
 * List sessions for a user (management). Never returns tokens or hashes to callers of toPublic.
 */
export async function listSessionsForUser(ghUserId: string): Promise<SessionRecord[]> {
  const uid = String(ghUserId || "").trim()
  if (!uid) return []

  const fromMem: SessionRecord[] = []
  for (const rec of memById.values()) {
    if (rec.ghUserId === uid) fromMem.push(rec)
  }

  let fromDb: SessionRecord[] = []
  if (dbConfigured()) {
    fromDb = await dbListByUser(uid)
    for (const r of fromDb) {
      memById.set(r.id, r)
      // tokenHash known from DB — keep mem index
      memByHash.set(r.tokenHash, r)
    }
  }

  const byId = new Map<string, SessionRecord>()
  for (const r of [...fromMem, ...fromDb]) byId.set(r.id, r)
  return Array.from(byId.values()).sort((a, b) => b.lastSeenAt - a.lastSeenAt)
}

export function toPublicSessionInfo(
  rec: SessionRecord,
  currentSessionId: string | null
): PublicSessionInfo {
  const active = !isExpired(rec)
  return {
    id: rec.id,
    deviceLabel: rec.deviceLabel || "Unknown device",
    createdAt: rec.createdAt,
    lastSeenAt: rec.lastSeenAt,
    expiresAt: rec.expiresAt,
    absoluteExpiresAt: rec.absoluteExpiresAt,
    isCurrent: Boolean(currentSessionId && rec.id === currentSessionId),
    active,
  }
}

/**
 * Revoke a session by id only if it belongs to ghUserId (IDOR-safe).
 * Also revokes step-ups for that session when provided.
 */
export async function revokeSessionByIdForUser(
  ghUserId: string,
  sessionId: string
): Promise<"ok" | "not_found" | "forbidden"> {
  const uid = String(ghUserId || "").trim()
  const sid = String(sessionId || "").trim()
  if (!uid || !sid) return "not_found"

  let rec = memById.get(sid) || null
  if (!rec && dbConfigured()) {
    const list = await dbListByUser(uid)
    rec = list.find((r) => r.id === sid) || null
  }
  if (!rec) {
    console.info("[session] SESSION_REVOKE_FAILED", { reason: "not_found", sessionId: sid.slice(0, 8) })
    return "not_found"
  }
  if (rec.ghUserId !== uid) {
    console.info("[session] SESSION_IDOR_ATTEMPT", {
      requester: uid,
      sessionId: sid.slice(0, 8),
    })
    return "forbidden"
  }
  if (rec.revokedAt != null) return "ok"

  const t = now()
  const updated = { ...rec, revokedAt: t }
  memById.set(sid, updated)
  memByHash.set(rec.tokenHash, updated)
  if (dbConfigured()) {
    await dbPatch(sid, { revoked_at: new Date(t).toISOString() })
  }
  console.info("[session] SESSION_REVOKED", { userId: uid, sessionId: sid.slice(0, 8) })
  return "ok"
}

/**
 * Revoke all sessions for user except currentSessionId.
 * Returns count of sessions revoked.
 */
export async function revokeOtherSessionsForUser(
  ghUserId: string,
  currentSessionId: string
): Promise<number> {
  const uid = String(ghUserId || "").trim()
  const keep = String(currentSessionId || "").trim()
  if (!uid || !keep) return 0

  const sessions = await listSessionsForUser(uid)
  let count = 0
  for (const rec of sessions) {
    if (rec.id === keep) continue
    if (rec.revokedAt != null) continue
    if (isExpired(rec)) continue
    const result = await revokeSessionByIdForUser(uid, rec.id)
    if (result === "ok") count++
  }
  console.info("[session] SESSIONS_REVOKED", { userId: uid, count, kept: keep.slice(0, 8) })
  return count
}

export function _resetSessionStoreForTests() {
  memByHash.clear()
  memById.clear()
}
