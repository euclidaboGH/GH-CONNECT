import { socialRpc } from "@/lib/server/social/rpc"

export type DurableFeedPreferences = {
  hiddenPostIds: string[]
  notInterestedPostIds: string[]
  mutedTopics: string[]
  filter: "for-you" | "following" | "friends" | "communities" | "trending" | "saved"
  locationLane: "worldwide" | "city" | "country"
  intentionBias: "balanced" | "friendship" | "professional" | "dating"
  focusMode: boolean
}

export const DEFAULT_FEED_PREFERENCES: DurableFeedPreferences = {
  hiddenPostIds: [],
  notInterestedPostIds: [],
  mutedTopics: [],
  filter: "for-you",
  locationLane: "worldwide",
  intentionBias: "balanced",
  focusMode: false,
}

function parseRpcData(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) value = value[0]
  return value && typeof value === "object" ? value as Record<string, unknown> : null
}

export async function readDurableFeedPreferences(userId: string): Promise<{ ok: true; exists: boolean; preferences: DurableFeedPreferences } | { ok: false; error: string }> {
  const result = await socialRpc("gh_feed_preferences_get", { p_user_id: userId })
  if (!result.ok) return { ok: false, error: result.error || "FEED_PREFERENCES_READ_FAILED" }
  const data = parseRpcData(result.data)
  const raw = data?.preferences
  if (data?.ok !== true || !raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "FEED_PREFERENCES_PAYLOAD_INVALID" }
  }
  const row = raw as Record<string, unknown>
  const validIds = (v: unknown, max: number) => Array.isArray(v)
    ? [...new Set(v.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter((item) => item.length > 0 && item.length <= 180))].slice(-max)
    : []
  const validTopics = Array.isArray(row.mutedTopics)
    ? [...new Set(row.mutedTopics.filter((item): item is string => typeof item === "string").map((item) => item.trim().normalize("NFKC").toLocaleLowerCase()).filter((item) => /^[\p{L}\p{N}][\p{L}\p{N}\p{M}_]{1,31}$/u.test(item)))].slice(0, 100)
    : []
  const preferences: DurableFeedPreferences = {
    hiddenPostIds: validIds(row.hiddenPostIds, 200),
    notInterestedPostIds: validIds(row.notInterestedPostIds, 200),
    mutedTopics: validTopics,
    filter: row.filter === "following" || row.filter === "friends" || row.filter === "communities" || row.filter === "trending" || row.filter === "saved" ? row.filter : "for-you",
    locationLane: row.locationLane === "city" || row.locationLane === "country" ? row.locationLane : "worldwide",
    intentionBias: row.intentionBias === "friendship" || row.intentionBias === "professional" || row.intentionBias === "dating" ? row.intentionBias : "balanced",
    focusMode: row.focusMode === true,
  }
  return { ok: true, exists: data.exists === true, preferences }
}

export async function writeDurableFeedPreferences(userId: string, preferences: DurableFeedPreferences): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await socialRpc("gh_feed_preferences_set", { p_user_id: userId, p_preferences: preferences })
  if (!result.ok) return { ok: false, error: result.error || "FEED_PREFERENCES_WRITE_FAILED" }
  const data = parseRpcData(result.data)
  return data?.ok === true && data?.durable === true
    ? { ok: true }
    : { ok: false, error: typeof data?.error === "string" ? data.error : "FEED_PREFERENCES_NOT_DURABLE" }
}
