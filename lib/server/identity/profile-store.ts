/**
 * Server-authoritative GH user profile (social / onboarding presentation).
 * Never stores balances, membership tier, or payment secrets.
 * Prefer Supabase when privileged; memory only outside production.
 */

import { readGhcServerEnv, hasPrivilegedDatabase } from "@/lib/server/economy/env"

export type ServerProfileRecord = {
  ghUserId: string
  displayName: string | null
  username: string | null
  bio: string | null
  city: string | null
  country: string | null
  profession: string | null
  hometown: string | null
  education: string | null
  status: string | null
  age: number | null
  gender: string | null
  primaryMode: string | null
  interests: string[]
  connectionIntents: string[]
  skills: string[]
  photos: string[]
  coverPhoto: string | null
  /** Extra non-financial fields (bounded) */
  profilePayload: Record<string, unknown>
  onboarded: boolean
  schemaVersion: number
  createdAt: number
  updatedAt: number
}

const MAX_PHOTOS = 6
const MAX_INTERESTS = 30
const MAX_BIO = 500
const MAX_NAME = 80
const MAX_PAYLOAD_JSON = 24_000

const mem = new Map<string, ServerProfileRecord>()

function dbConfigured(): boolean {
  return hasPrivilegedDatabase()
}

function isProd(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.GHC_ENV === "production"
  )
}

function now() {
  return Date.now()
}

function asStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x) => typeof x === "string")
    .map((x) => String(x).trim())
    .filter(Boolean)
    .slice(0, max)
}

function clipStr(v: unknown, max: number): string | null {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  return s.slice(0, max)
}

/** Strip financial / membership fields clients must not control. */
export function sanitizeProfileInput(
  ghUserId: string,
  input: Record<string, unknown>,
  existing?: ServerProfileRecord | null
): ServerProfileRecord {
  const interests = asStringArray(input.interests, MAX_INTERESTS)
  const connectionIntents = asStringArray(
    input.connectionIntents ?? input.connection_intents,
    20
  )
  const skills = asStringArray(input.skills, 30)
  const photos = asStringArray(input.photos, MAX_PHOTOS)

  let age: number | null = null
  if (typeof input.age === "number" && Number.isFinite(input.age)) {
    const a = Math.floor(input.age)
    if (a >= 18 && a <= 120) age = a
  } else if (existing?.age != null) {
    age = existing.age
  }

  const onboarded =
    input.onboarded === true ||
    input.onboarded === false
      ? Boolean(input.onboarded)
      : existing?.onboarded ?? false

  // Never accept client balance / tier
  const payloadIn =
    input.profilePayload && typeof input.profilePayload === "object"
      ? (input.profilePayload as Record<string, unknown>)
      : {}
  const banned = new Set([
    "balance",
    "ghcBalance",
    "wallet",
    "membership",
    "tier",
    "entitlement",
    "pendingBalance",
    "lifetimeEarned",
  ])
  const profilePayload: Record<string, unknown> = {
    ...(existing?.profilePayload || {}),
  }
  for (const [k, v] of Object.entries(payloadIn)) {
    if (banned.has(k)) continue
    profilePayload[k] = v
  }
  let payloadJson = "{}"
  try {
    payloadJson = JSON.stringify(profilePayload)
    if (payloadJson.length > MAX_PAYLOAD_JSON) {
      // keep existing payload if new is oversized
      return sanitizeProfileInput(
        ghUserId,
        { ...input, profilePayload: existing?.profilePayload || {} },
        existing
      )
    }
  } catch {
    /* */
  }

  const t = now()
  return {
    ghUserId,
    displayName:
      clipStr(input.displayName ?? input.display_name, MAX_NAME) ??
      existing?.displayName ??
      null,
    username:
      clipStr(input.username, 40) ?? existing?.username ?? null,
    bio: clipStr(input.bio, MAX_BIO) ?? existing?.bio ?? null,
    city: clipStr(input.city, 80) ?? existing?.city ?? null,
    country: clipStr(input.country, 80) ?? existing?.country ?? null,
    profession: clipStr(input.profession, 80) ?? existing?.profession ?? null,
    hometown: clipStr(input.hometown, 80) ?? existing?.hometown ?? null,
    education: clipStr(input.education, 120) ?? existing?.education ?? null,
    status: clipStr(input.status, 120) ?? existing?.status ?? null,
    age,
    gender: clipStr(input.gender, 40) ?? existing?.gender ?? null,
    primaryMode:
      clipStr(input.primaryMode ?? input.primary_mode, 40) ??
      existing?.primaryMode ??
      null,
    interests: interests.length ? interests : existing?.interests ?? [],
    connectionIntents: connectionIntents.length
      ? connectionIntents
      : existing?.connectionIntents ?? [],
    skills: skills.length ? skills : existing?.skills ?? [],
    photos: photos.length ? photos : existing?.photos ?? [],
    coverPhoto:
      clipStr(input.coverPhoto ?? input.cover_photo, 2000) ??
      existing?.coverPhoto ??
      null,
    profilePayload,
    onboarded,
    schemaVersion: 1,
    createdAt: existing?.createdAt ?? t,
    updatedAt: t,
  }
}

type DbRow = Record<string, unknown>

function rowToRecord(row: DbRow): ServerProfileRecord {
  return {
    ghUserId: String(row.gh_user_id || ""),
    displayName: row.display_name != null ? String(row.display_name) : null,
    username: row.username != null ? String(row.username) : null,
    bio: row.bio != null ? String(row.bio) : null,
    city: row.city != null ? String(row.city) : null,
    country: row.country != null ? String(row.country) : null,
    profession: row.profession != null ? String(row.profession) : null,
    hometown: row.hometown != null ? String(row.hometown) : null,
    education: row.education != null ? String(row.education) : null,
    status: row.status != null ? String(row.status) : null,
    age: typeof row.age === "number" ? row.age : null,
    gender: row.gender != null ? String(row.gender) : null,
    primaryMode: row.primary_mode != null ? String(row.primary_mode) : null,
    interests: asStringArray(row.interests, MAX_INTERESTS),
    connectionIntents: asStringArray(row.connection_intents, 20),
    skills: asStringArray(row.skills, 30),
    photos: asStringArray(row.photos, MAX_PHOTOS),
    coverPhoto: row.cover_photo != null ? String(row.cover_photo) : null,
    profilePayload:
      row.profile_payload && typeof row.profile_payload === "object"
        ? (row.profile_payload as Record<string, unknown>)
        : {},
    onboarded: Boolean(row.onboarded),
    schemaVersion: typeof row.schema_version === "number" ? row.schema_version : 1,
    createdAt: row.created_at
      ? Date.parse(String(row.created_at)) || now()
      : now(),
    updatedAt: row.updated_at
      ? Date.parse(String(row.updated_at)) || now()
      : now(),
  }
}

async function dbSelect(ghUserId: string): Promise<ServerProfileRecord | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_user_profiles?gh_user_id=eq.${encodeURIComponent(ghUserId)}&select=*&limit=1`
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

async function dbUpsert(rec: ServerProfileRecord): Promise<ServerProfileRecord | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  const body = {
    gh_user_id: rec.ghUserId,
    display_name: rec.displayName,
    username: rec.username,
    bio: rec.bio,
    city: rec.city,
    country: rec.country,
    profession: rec.profession,
    hometown: rec.hometown,
    education: rec.education,
    status: rec.status,
    age: rec.age,
    gender: rec.gender,
    primary_mode: rec.primaryMode,
    interests: rec.interests,
    connection_intents: rec.connectionIntents,
    skills: rec.skills,
    photos: rec.photos,
    cover_photo: rec.coverPhoto,
    profile_payload: rec.profilePayload,
    onboarded: rec.onboarded,
    schema_version: rec.schemaVersion,
    updated_at: new Date(rec.updatedAt).toISOString(),
  }
  try {
    const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_user_profiles`
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
      console.error("[profile-store] upsert failed", res.status)
      return null
    }
    const rows = (await res.json()) as DbRow[]
    if (Array.isArray(rows) && rows[0]) return rowToRecord(rows[0])
    return rec
  } catch (err) {
    console.error(
      "[profile-store] upsert error",
      err instanceof Error ? err.message : "unknown"
    )
    return null
  }
}

export function isProfileStoreDurable(): boolean {
  return dbConfigured()
}

export async function getServerProfile(
  ghUserId: string
): Promise<ServerProfileRecord | null> {
  const key = String(ghUserId || "").trim()
  if (!key) return null
  if (dbConfigured()) {
    const fromDb = await dbSelect(key)
    if (fromDb) {
      mem.set(key, fromDb)
      return fromDb
    }
  }
  return mem.get(key) || null
}

/**
 * Upsert profile for authenticated user. Idempotent merge; does not wipe
 * existing fields when input omits them (sanitize uses existing).
 */
export async function upsertServerProfile(
  ghUserId: string,
  input: Record<string, unknown>
): Promise<ServerProfileRecord | null> {
  const key = String(ghUserId || "").trim()
  if (!key) return null
  const existing = await getServerProfile(key)
  const next = sanitizeProfileInput(key, input, existing)

  if (dbConfigured()) {
    const saved = await dbUpsert(next)
    if (saved) {
      mem.set(key, saved)
      return saved
    }
    if (isProd()) {
      console.error("[profile-store] durable write failed in production")
      return null
    }
  } else if (isProd()) {
    console.error("[profile-store] no durable store in production")
    return null
  }

  mem.set(key, next)
  return next
}

/** Map server record to a partial client Profile shape (presentation only). */
export function serverProfileToClientPartial(
  rec: ServerProfileRecord
): Record<string, unknown> {
  return {
    id: rec.ghUserId,
    displayName: rec.displayName || "",
    username: rec.username,
    bio: rec.bio || "",
    city: rec.city || "",
    country: rec.country || "",
    profession: rec.profession || "",
    hometown: rec.hometown || "",
    education: rec.education || "",
    status: rec.status || "",
    age: rec.age ?? 18,
    gender: rec.gender || "prefer-not-to-say",
    primaryMode: rec.primaryMode || "social",
    interests: rec.interests,
    connectionIntents: rec.connectionIntents,
    skills: rec.skills,
    photos: rec.photos,
    coverPhoto: rec.coverPhoto,
    onboarded: rec.onboarded,
    createdAt: rec.createdAt,
    ...rec.profilePayload,
  }
}

export function _resetProfileStoreForTests() {
  mem.clear()
}
