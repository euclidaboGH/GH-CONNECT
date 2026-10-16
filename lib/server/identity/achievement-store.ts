/**
 * Server-authoritative achievement unlocks + non-financial progress counters.
 * Unlock is idempotent on (gh_user_id, achievement_id).
 * Never grants GHC or membership — presentation / progression only.
 */

import { readGhcServerEnv, hasPrivilegedDatabase } from "@/lib/server/economy/env"

export type ServerAchievementUnlock = {
  ghUserId: string
  achievementId: string
  unlockedAt: number
  sourceEvent: string | null
}

export type ServerProgress = {
  ghUserId: string
  counters: Record<string, number>
  updatedAt: number
}

const memUnlocks = new Map<string, ServerAchievementUnlock[]>()
const memProgress = new Map<string, ServerProgress>()

function dbConfigured() {
  return hasPrivilegedDatabase()
}

function isProd() {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.GHC_ENV === "production"
  )
}

function keyUser(uid: string) {
  return String(uid || "").trim()
}

export async function listAchievementsForUser(
  ghUserId: string
): Promise<ServerAchievementUnlock[]> {
  const uid = keyUser(ghUserId)
  if (!uid) return []
  if (dbConfigured()) {
    const env = readGhcServerEnv()
    if (env.supabaseUrl && env.supabaseServiceRoleKey) {
      try {
        const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_user_achievements?gh_user_id=eq.${encodeURIComponent(uid)}&select=gh_user_id,achievement_id,unlocked_at,source_event&order=unlocked_at.asc&limit=200`
        const res = await fetch(url, {
          headers: {
            apikey: env.supabaseServiceRoleKey,
            Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
            Accept: "application/json",
          },
          cache: "no-store",
        })
        if (res.ok) {
          const rows = (await res.json()) as Array<Record<string, unknown>>
          const list = (Array.isArray(rows) ? rows : []).map((r) => ({
            ghUserId: String(r.gh_user_id || uid),
            achievementId: String(r.achievement_id || ""),
            unlockedAt: r.unlocked_at
              ? Date.parse(String(r.unlocked_at)) || Date.now()
              : Date.now(),
            sourceEvent: r.source_event != null ? String(r.source_event) : null,
          })).filter((x) => x.achievementId)
          memUnlocks.set(uid, list)
          return list
        }
      } catch {
        /* fall through */
      }
    }
  }
  return memUnlocks.get(uid) || []
}

/**
 * Idempotent unlock. Does not validate catalog rules beyond non-empty id —
 * callers (evaluate routes) must enforce eligibility before calling.
 */
export async function unlockAchievement(input: {
  ghUserId: string
  achievementId: string
  sourceEvent?: string | null
}): Promise<ServerAchievementUnlock | null> {
  const uid = keyUser(input.ghUserId)
  const aid = String(input.achievementId || "").trim().slice(0, 80)
  if (!uid || !aid) return null

  const existing = await listAchievementsForUser(uid)
  const prior = existing.find((e) => e.achievementId === aid)
  if (prior) return prior

  const row: ServerAchievementUnlock = {
    ghUserId: uid,
    achievementId: aid,
    unlockedAt: Date.now(),
    sourceEvent: input.sourceEvent ? String(input.sourceEvent).slice(0, 120) : null,
  }

  if (dbConfigured()) {
    const env = readGhcServerEnv()
    if (env.supabaseUrl && env.supabaseServiceRoleKey) {
      try {
        const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_user_achievements`
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: env.supabaseServiceRoleKey,
            Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
            Prefer: "resolution=ignore-duplicates,return=representation",
            Accept: "application/json",
          },
          body: JSON.stringify({
            gh_user_id: uid,
            achievement_id: aid,
            source_event: row.sourceEvent,
            unlocked_at: new Date(row.unlockedAt).toISOString(),
          }),
          cache: "no-store",
        })
        if (res.ok) {
          const rows = (await res.json()) as Array<Record<string, unknown>>
          if (Array.isArray(rows) && rows[0]) {
            const r = rows[0]
            const saved: ServerAchievementUnlock = {
              ghUserId: String(r.gh_user_id || uid),
              achievementId: String(r.achievement_id || aid),
              unlockedAt: r.unlocked_at
                ? Date.parse(String(r.unlocked_at)) || row.unlockedAt
                : row.unlockedAt,
              sourceEvent:
                r.source_event != null ? String(r.source_event) : row.sourceEvent,
            }
            memUnlocks.set(uid, [...existing, saved])
            return saved
          }
          // ignore-duplicates with empty representation — re-list
          return (await listAchievementsForUser(uid)).find((e) => e.achievementId === aid) || row
        }
        if (isProd()) {
          console.error("[achievement-store] unlock failed", res.status)
          return null
        }
      } catch (err) {
        console.error(
          "[achievement-store] unlock error",
          err instanceof Error ? err.message : "unknown"
        )
        if (isProd()) return null
      }
    } else if (isProd()) {
      return null
    }
  } else if (isProd()) {
    return null
  }

  memUnlocks.set(uid, [...existing, row])
  return row
}

export async function getProgress(ghUserId: string): Promise<ServerProgress> {
  const uid = keyUser(ghUserId)
  const empty: ServerProgress = { ghUserId: uid, counters: {}, updatedAt: Date.now() }
  if (!uid) return empty
  if (dbConfigured()) {
    const env = readGhcServerEnv()
    if (env.supabaseUrl && env.supabaseServiceRoleKey) {
      try {
        const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_user_progress?gh_user_id=eq.${encodeURIComponent(uid)}&select=*&limit=1`
        const res = await fetch(url, {
          headers: {
            apikey: env.supabaseServiceRoleKey,
            Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
            Accept: "application/json",
          },
          cache: "no-store",
        })
        if (res.ok) {
          const rows = (await res.json()) as Array<Record<string, unknown>>
          if (rows[0]) {
            const c =
              rows[0].counters && typeof rows[0].counters === "object"
                ? (rows[0].counters as Record<string, number>)
                : {}
            const prog: ServerProgress = {
              ghUserId: uid,
              counters: c,
              updatedAt: rows[0].updated_at
                ? Date.parse(String(rows[0].updated_at)) || Date.now()
                : Date.now(),
            }
            memProgress.set(uid, prog)
            return prog
          }
        }
      } catch {
        /* */
      }
    }
  }
  return memProgress.get(uid) || empty
}

export function isAchievementStoreDurable(): boolean {
  return dbConfigured()
}
