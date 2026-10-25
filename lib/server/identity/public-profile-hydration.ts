/**
 * Rehydrates public author identity from the canonical gh_user_profiles store.
 * Only public display fields are selected; this helper never returns private
 * profile attributes and treats persisted post/comment labels as a fallback.
 */
import { readGhcServerEnv } from "@/lib/server/economy/env"

type Row = Record<string, unknown>

function firstString(row: Row, keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

function publicPhoto(value: unknown): string {
  let values: unknown[] = []
  if (Array.isArray(value)) values = value
  else if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value)
      if (Array.isArray(parsed)) values = parsed
      else if (/^https:\/\//i.test(value.trim()) || value.trim().startsWith("/")) values = [value.trim()]
    } catch {
      if (/^https:\/\//i.test(value.trim()) || value.trim().startsWith("/")) values = [value.trim()]
    }
  }
  const candidate = values.find((item) => typeof item === "string" && item.trim())
  const url = typeof candidate === "string" ? candidate.trim() : ""
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return ""
  if (url.startsWith("/") || /^https:\/\//i.test(url)) return url.slice(0, 2000)
  return ""
}

function quotePostgrestIn(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

/**
 * Accepts social records with author/user id aliases and fills their existing
 * name/photo aliases from the canonical public profile when available.
 * It is deliberately best-effort: a profile read outage does not break feeds.
 */
export async function hydratePublicProfileIdentity<T extends Row>(items: T[]): Promise<T[]> {
  if (!Array.isArray(items) || items.length === 0) return items
  const idByRow = items.map((row) => firstString(row, [
    "authorId", "author_id", "userId", "user_id", "ghUserId", "gh_user_id", "ownerId", "owner_id",
  ]))
  const ids = [...new Set(idByRow.filter((id) => id && id.length <= 180))].slice(0, 100)
  if (!ids.length) return items

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return items
  try {
    const query = new URLSearchParams({
      gh_user_id: `in.(${ids.map(quotePostgrestIn).join(",")})`,
      select: "gh_user_id,display_name,username,photos",
      limit: String(ids.length),
    })
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_user_profiles?${query.toString()}`, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    })
    if (!response.ok) return items
    const data: unknown = await response.json()
    if (!Array.isArray(data)) return items
    const profiles = new Map<string, { name: string; photo: string }>()
    for (const value of data) {
      if (!value || typeof value !== "object") continue
      const row = value as Row
      const id = firstString(row, ["gh_user_id"])
      if (!id) continue
      profiles.set(id, {
        name: firstString(row, ["display_name", "username"]).slice(0, 120),
        photo: publicPhoto(row.photos),
      })
    }
    return items.map((item, index) => {
      const profile = profiles.get(idByRow[index])
      if (!profile) return item
      const next: Row = { ...item }
      const existingName = firstString(item, ["authorName", "author_name", "displayName", "display_name", "name", "ownerName", "owner_name"])
      const name = profile.name || existingName
      if (name) {
        for (const key of ["authorName", "author_name", "displayName", "display_name", "name", "ownerName", "owner_name"]) {
          if (key in item || key === "authorName" && ("authorId" in item || "author_id" in item) || key === "displayName" && ("userId" in item || "user_id" in item)) next[key] = name
        }
      }
      const existingPhoto = firstString(item, ["authorPhoto", "author_photo", "avatarUrl", "avatar_url", "photo", "photoUrl", "photo_url"])
      const photo = profile.photo || existingPhoto
      if (photo) {
        for (const key of ["authorPhoto", "author_photo", "avatarUrl", "avatar_url", "photo", "photoUrl", "photo_url"]) {
          if (key in item || key === "authorPhoto" && ("authorId" in item || "author_id" in item) || key === "avatarUrl" && ("userId" in item || "user_id" in item)) next[key] = photo
        }
      }
      return next as T
    })
  } catch {
    return items
  }
}
