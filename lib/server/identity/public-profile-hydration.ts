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
  if (!url || url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("//") || url.includes("\\") || /[\u0000-\u001f\u007f]/.test(url)) return ""
  if (url.startsWith("/") || /^https:\/\//i.test(url)) return url.slice(0, 2000)
  return ""
}

function quotePostgrestIn(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

/** Parse a small upstream JSON response with a hard streaming byte limit. */
async function readBoundedProfileRows(response: Response, maxBytes: number): Promise<unknown[] | null> {
  const declared = response.headers.get("content-length")
  if (declared !== null) {
    if (!/^\d+$/.test(declared) || Number(declared) > maxBytes) return null
  }
  if (!response.body) return null
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel("profile response exceeds configured limit").catch(() => undefined)
        return null
      }
      chunks.push(value)
    }
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Hydrate social authors and nested comment/reply trees from public profile fields.
 * Best-effort by design: upstream identity failures never break social reads.
 */
const NESTED_PUBLIC_ROWS = ["comments", "replies", "children"] as const
const MAX_NESTED_ROWS = 500
const MAX_NESTED_DEPTH = 12

export async function hydratePublicProfileIdentity<T extends Row>(items: T[]): Promise<T[]> {
  if (!Array.isArray(items) || items.length === 0) return items
  const collected: Row[] = []
  const collect = (row: unknown, depth: number) => {
    if (!row || typeof row !== "object" || Array.isArray(row) || collected.length >= MAX_NESTED_ROWS || depth > MAX_NESTED_DEPTH) return
    const record = row as Row
    collected.push(record)
    for (const key of NESTED_PUBLIC_ROWS) {
      const children = record[key]
      if (Array.isArray(children)) for (const child of children) collect(child, depth + 1)
    }
  }
  for (const item of items) collect(item, 0)

  const idByRow = new Map<Row, string>()
  for (const row of collected) idByRow.set(row, firstString(row, [
    "authorId", "author_id", "userId", "user_id", "ghUserId", "gh_user_id", "ownerId", "owner_id",
  ]))
  const ids = [...new Set([...idByRow.values()].filter((id) => id && id.length <= 180))].slice(0, 100)
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
      headers: { apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return items
    const data = await readBoundedProfileRows(response, 1024 * 1024)
    if (!data || data.length > ids.length) return items
    const requestedIds = new Set(ids)
    const profiles = new Map<string, { name: string; photo: string }>()
    for (const value of data) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue
      const row = value as Row
      const id = firstString(row, ["gh_user_id"])
      if (!id || id.length > 180 || !requestedIds.has(id)) continue
      profiles.set(id, { name: firstString(row, ["display_name", "username"]).slice(0, 120), photo: publicPhoto(row.photos) })
    }

    let transformedRows = 0
    const transform = (item: Row, depth: number): Row => {
      transformedRows += 1
      if (transformedRows > MAX_NESTED_ROWS) return item
      const id = idByRow.get(item) || firstString(item, ["authorId", "author_id", "userId", "user_id", "ghUserId", "gh_user_id", "ownerId", "owner_id"])
      const profile = profiles.get(id)
      let next: Row = item
      if (profile) {
        next = { ...item }
        const existingName = firstString(item, ["authorName", "author_name", "displayName", "display_name", "name", "ownerName", "owner_name"])
        const name = profile.name || existingName
        if (name) for (const key of ["authorName", "author_name", "displayName", "display_name", "name", "ownerName", "owner_name"]) {
          if (key in item || (key === "authorName" && ("authorId" in item || "author_id" in item)) || (key === "displayName" && ("userId" in item || "user_id" in item))) next[key] = name
        }
        // Validate legacy/persisted fallbacks too; never re-emit unsafe avatar schemes.
        const existingPhoto = publicPhoto(firstString(item, ["authorPhoto", "author_photo", "avatarUrl", "avatar_url", "photo", "photoUrl", "photo_url"]))
        const photo = profile.photo || existingPhoto
        if (photo) for (const key of ["authorPhoto", "author_photo", "avatarUrl", "avatar_url", "photo", "photoUrl", "photo_url"]) {
          if (key in item || (key === "authorPhoto" && ("authorId" in item || "author_id" in item)) || (key === "avatarUrl" && ("userId" in item || "user_id" in item))) next[key] = photo
        }
      }
      if (depth < MAX_NESTED_DEPTH) for (const key of NESTED_PUBLIC_ROWS) {
        const children = next[key]
        if (!Array.isArray(children)) continue
        const transformed = children.map((child) => child && typeof child === "object" && !Array.isArray(child) ? transform(child as Row, depth + 1) : child)
        if (transformed.some((child, index) => child !== children[index])) {
          if (next === item) next = { ...item }
          next[key] = transformed
        }
      }
      return next
    }
    return items.map((item) => transform(item, 0) as T)
  } catch {
    return items
  }
}
