/**
 * GreenHaven Spotlight Tags — max 5 communities, max 10 profiles, topic tags from body.
 */
export const SPOTLIGHT_MAX_COMMUNITIES = 5
export const SPOTLIGHT_MAX_PROFILES = 10
export const SPOTLIGHT_MAX_TOPIC_TAGS = 15

export type SpotlightCommunity = { id: string; name: string; slug?: string }
export type SpotlightProfile = { id: string; username: string; displayName?: string; photo?: string }

export function normalizeTopicTag(raw: string): string | null {
  const t = raw.replace(/^#/, "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "")
  if (t.length < 2 || t.length > 40) return null
  return t
}
export function extractTopicHashtags(content: string, max = SPOTLIGHT_MAX_TOPIC_TAGS): string[] {
  const matches = content.match(/#[a-zA-Z][\w]{1,39}/g) || []
  const out: string[] = []
  const seen = new Set<string>()
  for (const m of matches) {
    const n = normalizeTopicTag(m)
    if (!n || seen.has(n)) continue
    seen.add(n); out.push(n)
    if (out.length >= max) break
  }
  return out
}
export function sanitizeSpotlightCommunities(input: unknown): SpotlightCommunity[] {
  if (!Array.isArray(input)) return []
  const out: SpotlightCommunity[] = []; const seen = new Set<string>()
  for (const item of input) {
    if (!item || typeof item !== "object") continue
    const id = String((item as SpotlightCommunity).id || "").trim()
    const name = String((item as SpotlightCommunity).name || "").trim().slice(0, 80)
    if (!id || !name || seen.has(id)) continue
    seen.add(id); out.push({ id, name })
    if (out.length >= SPOTLIGHT_MAX_COMMUNITIES) break
  }
  return out
}
export function sanitizeSpotlightProfiles(input: unknown): SpotlightProfile[] {
  if (!Array.isArray(input)) return []
  const out: SpotlightProfile[] = []; const seen = new Set<string>()
  for (const item of input) {
    if (!item || typeof item !== "object") continue
    const id = String((item as SpotlightProfile).id || "").trim()
    const username = String((item as SpotlightProfile).username || "").trim().replace(/^@/, "").slice(0, 40)
    if (!id || !username || seen.has(id)) continue
    seen.add(id); out.push({ id, username })
    if (out.length >= SPOTLIGHT_MAX_PROFILES) break
  }
  return out
}
export function mergeHashtags(content: string, explicit?: string[] | null): string[] {
  const fromText = extractTopicHashtags(content)
  const extra = (explicit || []).map(normalizeTopicTag).filter((x): x is string => Boolean(x))
  const seen = new Set<string>(); const out: string[] = []
  for (const t of [...fromText, ...extra]) {
    if (seen.has(t)) continue
    seen.add(t); out.push(t)
    if (out.length >= SPOTLIGHT_MAX_TOPIC_TAGS) break
  }
  return out
}
