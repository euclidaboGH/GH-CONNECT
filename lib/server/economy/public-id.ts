/**
 * Phase D5 — server-side GreenHaven public ID ensure / resolve.
 * Falls back to process memory when DB is not configured (Studio / local).
 */

import { hasPrivilegedDatabase, readGhcServerEnv, type GhcServerEnv } from "./env"
import {
  deriveGreenHavenId,
  GH_ID_REGEX,
  normalizeGreenHavenId,
} from "@/lib/domains/greenhaven-id"

function isDatabaseConfigured(): boolean {
  return hasPrivilegedDatabase(readGhcServerEnv())
}

function allowMemoryServer(): boolean {
  if (isDatabaseConfigured()) return false
  return process.env.GHC_SERVER_MEMORY === "1" || process.env.NODE_ENV === "test"
}

export type PublicIdentity = {
  userId: string
  publicId: string
  displayName?: string | null
  avatarUrl?: string | null
  /** true when row was created in this call */
  created?: boolean
  /** local_fallback | database */
  source: "database" | "memory"
}

const memoryIds = new Map<string, PublicIdentity>()
const memoryByPublic = new Map<string, string>()

function memoryEnsure(
  userId: string,
  displayName?: string | null,
  avatarUrl?: string | null,
  preferred?: string | null
): PublicIdentity {
  const existing = memoryIds.get(userId)
  if (existing) {
    if (displayName || avatarUrl) {
      const next = {
        ...existing,
        displayName: displayName ?? existing.displayName,
        avatarUrl: avatarUrl ?? existing.avatarUrl,
      }
      memoryIds.set(userId, next)
      return { ...next, created: false, source: "memory" }
    }
    return { ...existing, created: false, source: "memory" }
  }
  let publicId =
    preferred && GH_ID_REGEX.test(normalizeGreenHavenId(preferred))
      ? normalizeGreenHavenId(preferred)
      : deriveGreenHavenId(userId)
  // collision
  let attempts = 0
  while (memoryByPublic.has(publicId) && memoryByPublic.get(publicId) !== userId && attempts < 8) {
    attempts++
    publicId = deriveGreenHavenId(`${userId}:${attempts}`)
  }
  const row: PublicIdentity = {
    userId,
    publicId,
    displayName: displayName || null,
    avatarUrl: avatarUrl || null,
    created: true,
    source: "memory",
  }
  memoryIds.set(userId, row)
  memoryByPublic.set(publicId, userId)
  return row
}

function memoryResolve(publicId: string): PublicIdentity | null {
  const id = normalizeGreenHavenId(publicId)
  if (!GH_ID_REGEX.test(id)) return null
  const userId = memoryByPublic.get(id)
  if (!userId) return null
  const row = memoryIds.get(userId)
  return row ? { ...row, created: false, source: "memory" } : null
}

async function rpcEnsure(
  userId: string,
  displayName?: string | null,
  avatarUrl?: string | null,
  preferred?: string | null,
  env: GhcServerEnv = readGhcServerEnv()
): Promise<PublicIdentity | null> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_ensure_public_id`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_display_name: displayName ?? null,
        p_avatar_url: avatarUrl ?? null,
        p_preferred: preferred ? normalizeGreenHavenId(preferred) : null,
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    if (data?.ok !== true) return null
    return {
      userId: String(data.userId),
      publicId: String(data.publicId),
      displayName: (data.displayName as string) || null,
      avatarUrl: (data.avatarUrl as string) || null,
      created: Boolean(data.created),
      source: "database",
    }
  } catch {
    return null
  }
}

async function rpcResolve(
  publicId: string,
  env: GhcServerEnv = readGhcServerEnv()
): Promise<PublicIdentity | null> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_resolve_public_id`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({ p_public_id: publicId }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    if (data?.ok !== true) return null
    return {
      userId: String(data.userId),
      publicId: String(data.publicId),
      displayName: (data.displayName as string) || null,
      avatarUrl: (data.avatarUrl as string) || null,
      source: "database",
    }
  } catch {
    return null
  }
}

export async function ensurePublicIdentity(input: {
  userId: string
  displayName?: string | null
  avatarUrl?: string | null
  preferred?: string | null
}): Promise<PublicIdentity | null> {
  const userId = String(input.userId || "").trim()
  if (!userId) return null

  if (isDatabaseConfigured()) {
    const row = await rpcEnsure(
      userId,
      input.displayName,
      input.avatarUrl,
      input.preferred
    )
    if (row) return row
  }

  if (allowMemoryServer()) {
    return memoryEnsure(userId, input.displayName, input.avatarUrl, input.preferred)
  }

  // Last resort temporary compatibility (never claim DB authority)
  return memoryEnsure(userId, input.displayName, input.avatarUrl, input.preferred)
}

export async function resolvePublicIdentity(
  publicId: string
): Promise<PublicIdentity | null> {
  const id = normalizeGreenHavenId(publicId)
  if (!GH_ID_REGEX.test(id)) return null

  if (isDatabaseConfigured()) {
    const row = await rpcResolve(id)
    if (row) return row
  }

  if (allowMemoryServer()) {
    return memoryResolve(id)
  }

  return memoryResolve(id)
}

/** Public API projection — never includes balance/email/token */
export function toPublicIdentityDto(row: PublicIdentity) {
  return {
    publicId: row.publicId,
    displayName: row.displayName || null,
    avatarUrl: row.avatarUrl || null,
    /** Opaque recipient key for transfer (internal user id) — only when caller is authorized */
    recipientKey: row.userId,
    source: row.source,
  }
}
