/**
 * Pi ↔ GreenHaven identity mapping (server-only).
 *
 * Compliance (Pi Platform docs):
 * - uid from client is untrusted; only /v2/me is source of truth
 * - uid is app-specific; may change if user revokes app permissions
 * - Store verified pi_app_uid as the join key for this app only
 * - NEVER store raw Pi access tokens
 *
 * Persistence:
 * - Prefer Supabase table public.gh_pi_identities when service role is configured
 * - Fall back to process memory only when DB is unavailable (local/dev)
 *
 * No economics / payment changes.
 */

import { readGhcServerEnv, hasPrivilegedDatabase } from "@/lib/server/economy/env"

export type PiIdentityRecord = {
  /** GreenHaven canonical user id (stable) */
  ghUserId: string
  /** Verified app-specific uid from GET /v2/me */
  piAppUid: string
  /** Display username from /me (may change) */
  piUsername: string | null
  /** Whether GreenHaven onboarding (interests, intent, etc.) is complete */
  onboardingCompleted: boolean
  createdAt: number
  lastSeenAt: number
  verifiedAt: number
  /** Optional link to richer GH profile row */
  greenhavenProfileId?: string | null
}

export type IdentityConflictError = {
  code: "IDENTITY_CONFLICT"
  message: string
  piAppUid: string
  existingGhUserId: string
}

// ---------------------------------------------------------------------------
// In-memory fallback (non-durable; used when Supabase is not configured)
// ---------------------------------------------------------------------------

const byPiUid = new Map<string, PiIdentityRecord>()
const byGhUserId = new Map<string, PiIdentityRecord>()

function now() {
  return Date.now()
}

function newGhUserId(piAppUid: string): string {
  return String(piAppUid).trim()
}

function memoryGetByPi(piAppUid: string): PiIdentityRecord | null {
  const key = String(piAppUid || "").trim()
  if (!key) return null
  return byPiUid.get(key) || null
}

function memoryGetByGh(ghUserId: string): PiIdentityRecord | null {
  const key = String(ghUserId || "").trim()
  if (!key) return null
  return byGhUserId.get(key) || null
}

function memoryPut(rec: PiIdentityRecord): void {
  byPiUid.set(rec.piAppUid, rec)
  byGhUserId.set(rec.ghUserId, rec)
}

// ---------------------------------------------------------------------------
// Supabase REST helpers (service role — same pattern as membership/payments)
// ---------------------------------------------------------------------------

function dbConfigured(): boolean {
  return hasPrivilegedDatabase()
}

type DbRow = {
  pi_app_uid: string
  gh_user_id: string
  pi_username: string | null
  onboarding_completed: boolean
  greenhaven_profile_id: string | null
  created_at: string
  updated_at: string
  last_seen_at: string
  verified_at: string
}

function rowToRecord(row: DbRow): PiIdentityRecord {
  return {
    piAppUid: String(row.pi_app_uid),
    ghUserId: String(row.gh_user_id),
    piUsername: row.pi_username != null ? String(row.pi_username) : null,
    onboardingCompleted: Boolean(row.onboarding_completed),
    createdAt: Date.parse(row.created_at) || now(),
    lastSeenAt: Date.parse(row.last_seen_at) || now(),
    verifiedAt: Date.parse(row.verified_at) || now(),
    greenhavenProfileId:
      row.greenhaven_profile_id != null ? String(row.greenhaven_profile_id) : null,
  }
}

async function dbSelectByPi(piAppUid: string): Promise<PiIdentityRecord | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_pi_identities?pi_app_uid=eq.${encodeURIComponent(piAppUid)}&select=*&limit=1`
    const res = await fetch(url, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    })
    if (!res.ok) {
      if (res.status === 404 || res.status === 406) return null
      console.error("[pi-identity] dbSelectByPi failed", res.status)
      return null
    }
    const rows = (await res.json()) as DbRow[]
    if (!Array.isArray(rows) || rows.length === 0) return null
    return rowToRecord(rows[0])
  } catch (err) {
    console.error("[pi-identity] dbSelectByPi error", err instanceof Error ? err.message : "unknown")
    return null
  }
}

async function dbSelectByGh(ghUserId: string): Promise<PiIdentityRecord | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_pi_identities?gh_user_id=eq.${encodeURIComponent(ghUserId)}&select=*&limit=1`
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
    if (!Array.isArray(rows) || rows.length === 0) return null
    return rowToRecord(rows[0])
  } catch (err) {
    console.error("[pi-identity] dbSelectByGh error", err instanceof Error ? err.message : "unknown")
    return null
  }
}

async function dbUpsert(rec: PiIdentityRecord): Promise<PiIdentityRecord | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  const body = {
    pi_app_uid: rec.piAppUid,
    gh_user_id: rec.ghUserId,
    pi_username: rec.piUsername,
    onboarding_completed: rec.onboardingCompleted,
    greenhaven_profile_id: rec.greenhavenProfileId ?? null,
    updated_at: new Date().toISOString(),
    last_seen_at: new Date(rec.lastSeenAt).toISOString(),
    verified_at: new Date(rec.verifiedAt).toISOString(),
    // created_at set only on insert via DB default; Prefer: resolution-merge keeps existing
  }
  try {
    const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_pi_identities`
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        Prefer: "resolution=merge-duplicates,return=representation",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.error("[pi-identity] dbUpsert failed", res.status, text.slice(0, 200))
      return null
    }
    const rows = (await res.json()) as DbRow[]
    if (Array.isArray(rows) && rows[0]) return rowToRecord(rows[0])
    // Some PostgREST configs return empty on merge; re-read
    return dbSelectByPi(rec.piAppUid)
  } catch (err) {
    console.error("[pi-identity] dbUpsert error", err instanceof Error ? err.message : "unknown")
    return null
  }
}

async function dbMarkOnboarding(ghUserId: string): Promise<PiIdentityRecord | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_pi_identities?gh_user_id=eq.${encodeURIComponent(ghUserId)}`
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        Prefer: "return=representation",
        Accept: "application/json",
      },
      body: JSON.stringify({
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      }),
      cache: "no-store",
    })
    if (!res.ok) {
      console.error("[pi-identity] dbMarkOnboarding failed", res.status)
      return null
    }
    const rows = (await res.json()) as DbRow[]
    if (!Array.isArray(rows) || rows.length === 0) return null
    return rowToRecord(rows[0])
  } catch (err) {
    console.error("[pi-identity] dbMarkOnboarding error", err instanceof Error ? err.message : "unknown")
    return null
  }
}

// ---------------------------------------------------------------------------
// Public async API (authoritative)
// ---------------------------------------------------------------------------

/**
 * Look up by verified Pi app uid.
 */
export async function getByPiAppUid(piAppUid: string): Promise<PiIdentityRecord | null> {
  const key = String(piAppUid || "").trim()
  if (!key) return null
  if (dbConfigured()) {
    const fromDb = await dbSelectByPi(key)
    if (fromDb) {
      memoryPut(fromDb)
      return fromDb
    }
  }
  return memoryGetByPi(key)
}

export async function getByGhUserId(ghUserId: string): Promise<PiIdentityRecord | null> {
  const key = String(ghUserId || "").trim()
  if (!key) return null
  if (dbConfigured()) {
    const fromDb = await dbSelectByGh(key)
    if (fromDb) {
      memoryPut(fromDb)
      return fromDb
    }
  }
  return memoryGetByGh(key)
}

/**
 * Find or create mapping after successful /me verification.
 * Returning users: existing record, onboardingCompleted preserved.
 * New users: onboardingCompleted = false → client should run GH onboarding only.
 *
 * Conflict: if gh_user_id uniqueness would be violated by a different pi_app_uid
 * mapping to the same gh id with mismatched data — we do not auto-merge; we
 * keep pi_app_uid as primary key (new row) and log. Current scheme uses
 * ghUserId === piAppUid on create so conflict is rare.
 */
export async function findOrCreateFromVerifiedPi(input: {
  piAppUid: string
  piUsername?: string | null
}): Promise<{ record: PiIdentityRecord; isNew: boolean }> {
  const piAppUid = String(input.piAppUid || "").trim()
  if (!piAppUid) {
    throw new Error("piAppUid required")
  }

  const username =
    input.piUsername != null && String(input.piUsername).trim()
      ? String(input.piUsername).trim()
      : null

  // Durable path
  if (dbConfigured()) {
    const existing = await dbSelectByPi(piAppUid)
    if (existing) {
      const updated: PiIdentityRecord = {
        ...existing,
        piUsername: username ?? existing.piUsername,
        lastSeenAt: now(),
        verifiedAt: now(),
      }
      const saved = (await dbUpsert(updated)) || updated
      memoryPut(saved)
      return { record: saved, isNew: false }
    }

    // Detect rare conflict: another pi uid already owns this gh_user_id scheme
    const ghUserId = newGhUserId(piAppUid)
    const byGh = await dbSelectByGh(ghUserId)
    if (byGh && byGh.piAppUid !== piAppUid) {
      console.error("[pi-identity] IDENTITY_CONFLICT", {
        piAppUid,
        existingGhUserId: byGh.ghUserId,
        existingPiAppUid: byGh.piAppUid,
      })
      // Do not auto-merge. Treat as new mapping under pi uid (unique PK).
      // Caller may surface conflict if needed.
    }

    const created: PiIdentityRecord = {
      ghUserId,
      piAppUid,
      piUsername: username,
      onboardingCompleted: false,
      createdAt: now(),
      lastSeenAt: now(),
      verifiedAt: now(),
      greenhavenProfileId: null,
    }
    const saved = (await dbUpsert(created)) || created
    memoryPut(saved)
    return { record: saved, isNew: true }
  }

  // Memory fallback
  const existingMem = memoryGetByPi(piAppUid)
  if (existingMem) {
    const updated: PiIdentityRecord = {
      ...existingMem,
      piUsername: username ?? existingMem.piUsername,
      lastSeenAt: now(),
      verifiedAt: now(),
    }
    memoryPut(updated)
    return { record: updated, isNew: false }
  }

  const created: PiIdentityRecord = {
    ghUserId: newGhUserId(piAppUid),
    piAppUid,
    piUsername: username,
    onboardingCompleted: false,
    createdAt: now(),
    lastSeenAt: now(),
    verifiedAt: now(),
    greenhavenProfileId: null,
  }
  memoryPut(created)
  return { record: created, isNew: true }
}

/**
 * Mark onboarding complete for a GH user. Idempotent.
 */
export async function markOnboardingCompleted(
  ghUserId: string
): Promise<PiIdentityRecord | null> {
  const key = String(ghUserId || "").trim()
  if (!key) return null

  if (dbConfigured()) {
    let updated = await dbMarkOnboarding(key)
    if (!updated) {
      // Try by pi uid if caller passed pi uid as user id
      const byPi = await dbSelectByPi(key)
      if (byPi) {
        updated = await dbMarkOnboarding(byPi.ghUserId)
      }
    }
    if (updated) {
      memoryPut(updated)
      return updated
    }
  }

  const rec = memoryGetByGh(key) || memoryGetByPi(key)
  if (!rec) return null
  const updated: PiIdentityRecord = {
    ...rec,
    onboardingCompleted: true,
    lastSeenAt: now(),
  }
  memoryPut(updated)
  return updated
}

export async function touchLastSeen(ghUserId: string): Promise<void> {
  const key = String(ghUserId || "").trim()
  if (!key) return

  if (dbConfigured()) {
    const env = readGhcServerEnv()
    if (env.supabaseUrl && env.supabaseServiceRoleKey) {
      try {
        const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_pi_identities?gh_user_id=eq.${encodeURIComponent(key)}`
        await fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: env.supabaseServiceRoleKey,
            Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
          },
          body: JSON.stringify({
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
          cache: "no-store",
        })
      } catch {
        /* non-fatal */
      }
    }
  }

  const rec = memoryGetByGh(key)
  if (!rec) return
  memoryPut({ ...rec, lastSeenAt: now() })
}

/** Whether durable backend is active (for health / ops). */
export function isPiIdentityDurable(): boolean {
  return dbConfigured()
}

/** Test / ops helper — clears memory only; does not wipe DB */
export function _resetPiIdentityStoreForTests() {
  byPiUid.clear()
  byGhUserId.clear()
}
