/**
 * WebAuthn credential + challenge store (Phase 7).
 * Public keys and counters only — no private material.
 */

import { randomBytes } from "crypto"
import { readGhcServerEnv, hasPrivilegedDatabase } from "@/lib/server/economy/env"

export type StoredCredential = {
  id: string
  ghUserId: string
  credentialId: string
  publicKey: string
  counter: number
  transports: string[]
  deviceType: string | null
  backedUp: boolean
  label: string
  createdAt: number
  lastUsedAt: number | null
  revokedAt: number | null
}

export type StoredChallenge = {
  id: string
  ghUserId: string
  sessionId: string | null
  challenge: string
  purpose: "registration" | "authentication"
  expiresAt: number
  usedAt: number | null
}

const memCreds = new Map<string, StoredCredential>() // by credentialId
const memByUser = new Map<string, Set<string>>()
const memChallenges = new Map<string, StoredChallenge>() // by id

const CHALLENGE_TTL_MS = 5 * 60 * 1000

function now() {
  return Date.now()
}

function dbOk() {
  return hasPrivilegedDatabase()
}

function newId() {
  return randomBytes(16).toString("hex")
}

export function createChallenge(input: {
  ghUserId: string
  sessionId?: string | null
  purpose: "registration" | "authentication"
  challenge: string
}): StoredChallenge {
  const rec: StoredChallenge = {
    id: newId(),
    ghUserId: input.ghUserId,
    sessionId: input.sessionId || null,
    challenge: input.challenge,
    purpose: input.purpose,
    expiresAt: now() + CHALLENGE_TTL_MS,
    usedAt: null,
  }
  memChallenges.set(rec.id, rec)
  if (dbOk()) void dbInsertChallenge(rec)
  return rec
}

export async function consumeChallenge(input: {
  ghUserId: string
  purpose: "registration" | "authentication"
  challenge: string
}): Promise<StoredChallenge | null> {
  const t = now()
  for (const [id, c] of memChallenges) {
    if (
      c.ghUserId === input.ghUserId &&
      c.purpose === input.purpose &&
      c.challenge === input.challenge &&
      c.usedAt == null &&
      c.expiresAt > t
    ) {
      const used = { ...c, usedAt: t }
      memChallenges.set(id, used)
      if (dbOk()) void dbMarkChallengeUsed(id)
      return used
    }
  }
  if (dbOk()) {
    const found = await dbFindChallenge(input)
    if (found) {
      await dbMarkChallengeUsed(found.id)
      return { ...found, usedAt: t }
    }
  }
  return null
}

export async function saveCredential(rec: StoredCredential): Promise<void> {
  memCreds.set(rec.credentialId, rec)
  if (!memByUser.has(rec.ghUserId)) memByUser.set(rec.ghUserId, new Set())
  memByUser.get(rec.ghUserId)!.add(rec.credentialId)
  if (dbOk()) await dbInsertCredential(rec)
}

export async function listCredentialsForUser(
  ghUserId: string
): Promise<StoredCredential[]> {
  const uid = String(ghUserId || "").trim()
  const out: StoredCredential[] = []
  const ids = memByUser.get(uid)
  if (ids) {
    for (const cid of ids) {
      const c = memCreds.get(cid)
      if (c && c.revokedAt == null) out.push(c)
    }
  }
  if (dbOk()) {
    const rows = await dbListCredentials(uid)
    for (const r of rows) {
      memCreds.set(r.credentialId, r)
      if (!memByUser.has(uid)) memByUser.set(uid, new Set())
      memByUser.get(uid)!.add(r.credentialId)
      if (r.revokedAt == null && !out.find((x) => x.credentialId === r.credentialId)) {
        out.push(r)
      }
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt)
}

export async function getCredentialByCredentialId(
  credentialId: string
): Promise<StoredCredential | null> {
  const mem = memCreds.get(credentialId)
  if (mem && mem.revokedAt == null) return mem
  if (dbOk()) {
    const row = await dbGetCredential(credentialId)
    if (row && row.revokedAt == null) {
      memCreds.set(row.credentialId, row)
      return row
    }
  }
  return null
}

export async function updateCredentialCounter(
  credentialId: string,
  counter: number
): Promise<void> {
  const c = memCreds.get(credentialId)
  if (c) {
    memCreds.set(credentialId, {
      ...c,
      counter,
      lastUsedAt: now(),
    })
  }
  if (dbOk()) await dbUpdateCounter(credentialId, counter)
}

export async function revokeCredentialForUser(
  ghUserId: string,
  credentialRowId: string
): Promise<"ok" | "not_found" | "forbidden"> {
  const list = await listCredentialsForUser(ghUserId)
  // Also search memory including revoked? Only active for revoke
  let target: StoredCredential | null = null
  for (const c of memCreds.values()) {
    if (c.id === credentialRowId) {
      target = c
      break
    }
  }
  if (!target && dbOk()) {
    const all = await dbListCredentials(ghUserId, true)
    target = all.find((c) => c.id === credentialRowId) || null
  }
  if (!target) return "not_found"
  if (target.ghUserId !== ghUserId) {
    console.info("[webauthn] PASSKEY_REVOKE_IDOR", {
      userId: ghUserId,
      cred: credentialRowId.slice(0, 8),
    })
    return "forbidden"
  }
  const updated = { ...target, revokedAt: now() }
  memCreds.set(target.credentialId, updated)
  if (dbOk()) await dbRevoke(target.id)
  console.info("[webauthn] PASSKEY_REVOKED", {
    userId: ghUserId,
    cred: target.id.slice(0, 8),
  })
  return "ok"
}

export function toPublicCredential(c: StoredCredential) {
  return {
    id: c.id,
    label: c.label,
    deviceType: c.deviceType,
    backedUp: c.backedUp,
    createdAt: c.createdAt,
    lastUsedAt: c.lastUsedAt,
    // never: publicKey, credentialId raw if preferred — credentialId is not secret but we omit for less enumeration
  }
}

// --- DB helpers ---

async function dbInsertChallenge(rec: StoredChallenge) {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return
  try {
    await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_webauthn_challenges`, {
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
        challenge: rec.challenge,
        purpose: rec.purpose,
        expires_at: new Date(rec.expiresAt).toISOString(),
      }),
      cache: "no-store",
    })
  } catch {
    /* */
  }
}

async function dbFindChallenge(input: {
  ghUserId: string
  purpose: string
  challenge: string
}): Promise<StoredChallenge | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_webauthn_challenges?gh_user_id=eq.${encodeURIComponent(input.ghUserId)}&purpose=eq.${encodeURIComponent(input.purpose)}&challenge=eq.${encodeURIComponent(input.challenge)}&used_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1&select=*`
    const res = await fetch(url, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    })
    if (!res.ok) return null
    const rows = (await res.json()) as Array<Record<string, unknown>>
    if (!rows?.[0]) return null
    const r = rows[0]
    return {
      id: String(r.id),
      ghUserId: String(r.gh_user_id),
      sessionId: r.session_id != null ? String(r.session_id) : null,
      challenge: String(r.challenge),
      purpose: r.purpose as "registration" | "authentication",
      expiresAt: Date.parse(String(r.expires_at)) || 0,
      usedAt: null,
    }
  } catch {
    return null
  }
}

async function dbMarkChallengeUsed(id: string) {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return
  try {
    await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_webauthn_challenges?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({ used_at: new Date().toISOString() }),
        cache: "no-store",
      }
    )
  } catch {
    /* */
  }
}

async function dbInsertCredential(rec: StoredCredential) {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return
  try {
    await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_webauthn_credentials`, {
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
        credential_id: rec.credentialId,
        public_key: rec.publicKey,
        counter: rec.counter,
        transports: rec.transports,
        device_type: rec.deviceType,
        backed_up: rec.backedUp,
        label: rec.label,
        created_at: new Date(rec.createdAt).toISOString(),
      }),
      cache: "no-store",
    })
  } catch {
    /* */
  }
}

async function dbListCredentials(
  ghUserId: string,
  includeRevoked = false
): Promise<StoredCredential[]> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return []
  try {
    let url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_webauthn_credentials?gh_user_id=eq.${encodeURIComponent(ghUserId)}&select=*&order=created_at.desc`
    if (!includeRevoked) url += "&revoked_at=is.null"
    const res = await fetch(url, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    })
    if (!res.ok) return []
    const rows = (await res.json()) as Array<Record<string, unknown>>
    return (rows || []).map((r) => ({
      id: String(r.id),
      ghUserId: String(r.gh_user_id),
      credentialId: String(r.credential_id),
      publicKey: String(r.public_key),
      counter: Number(r.counter) || 0,
      transports: Array.isArray(r.transports) ? (r.transports as string[]) : [],
      deviceType: r.device_type != null ? String(r.device_type) : null,
      backedUp: Boolean(r.backed_up),
      label: String(r.label || "Passkey"),
      createdAt: Date.parse(String(r.created_at)) || 0,
      lastUsedAt: r.last_used_at ? Date.parse(String(r.last_used_at)) : null,
      revokedAt: r.revoked_at ? Date.parse(String(r.revoked_at)) : null,
    }))
  } catch {
    return []
  }
}

async function dbGetCredential(credentialId: string): Promise<StoredCredential | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_webauthn_credentials?credential_id=eq.${encodeURIComponent(credentialId)}&revoked_at=is.null&limit=1&select=*`
    const res = await fetch(url, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    })
    if (!res.ok) return null
    const rows = (await res.json()) as Array<Record<string, unknown>>
    if (!rows?.[0]) return null
    const r = rows[0]
    return {
      id: String(r.id),
      ghUserId: String(r.gh_user_id),
      credentialId: String(r.credential_id),
      publicKey: String(r.public_key),
      counter: Number(r.counter) || 0,
      transports: Array.isArray(r.transports) ? (r.transports as string[]) : [],
      deviceType: r.device_type != null ? String(r.device_type) : null,
      backedUp: Boolean(r.backed_up),
      label: String(r.label || "Passkey"),
      createdAt: Date.parse(String(r.created_at)) || 0,
      lastUsedAt: r.last_used_at ? Date.parse(String(r.last_used_at)) : null,
      revokedAt: null,
    }
  } catch {
    return null
  }
}

async function dbUpdateCounter(credentialId: string, counter: number) {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return
  try {
    await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_webauthn_credentials?credential_id=eq.${encodeURIComponent(credentialId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({
          counter,
          last_used_at: new Date().toISOString(),
        }),
        cache: "no-store",
      }
    )
  } catch {
    /* */
  }
}

async function dbRevoke(id: string) {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return
  try {
    await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_webauthn_credentials?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({ revoked_at: new Date().toISOString() }),
        cache: "no-store",
      }
    )
  } catch {
    /* */
  }
}

export function _resetWebAuthnStoreForTests() {
  memCreds.clear()
  memByUser.clear()
  memChallenges.clear()
}
