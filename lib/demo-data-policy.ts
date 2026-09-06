/**
 * Central production-safe demo/seed policy.
 * Production: never present Studio seed entities as real users/content.
 */

export function isDemoDataAllowed(): boolean {
  if (process.env.NEXT_PUBLIC_DISCOVERY_DEMO === "true") return true
  if (process.env.NEXT_PUBLIC_GHC_STUDIO === "true") return true
  if (process.env.NODE_ENV === "development") return true
  if (process.env.NODE_ENV === "test") return true
  return false
}

/** Re-export name used by discovery */
export const isDiscoveryDemoAllowed = isDemoDataAllowed

const SEED_NAME_RE =
  /^(sarah|emma|jessica|nicole|zainab|david|amina|kwame)(\s|$|\.)/i

export function isStudioSeedEntity(entity: unknown): boolean {
  if (!entity || typeof entity !== "object") return false
  const e = entity as Record<string, unknown>
  if (e.isDemo === true || e.isSeed === true || e.demo === true) return true
  const id = String(e.id || e.userId || e.uid || "")
  if (
    id.startsWith("seed-") ||
    id.startsWith("demo-") ||
    id.startsWith("live-") ||
    id.startsWith("sample-") ||
    id.startsWith("mock-")
  ) {
    return true
  }
  const name = String(e.name || e.displayName || e.authorName || e.creator || "")
  if (SEED_NAME_RE.test(name.trim())) return true
  return false
}

export function filterStudioSeedEntities<T>(list: T[] | null | undefined): T[] {
  if (!Array.isArray(list)) return []
  if (isDemoDataAllowed()) return list
  return list.filter((item) => !isStudioSeedEntity(item))
}

export function discoveryEmptyCopy(): { title: string; body: string } {
  return {
    title: "No people to show yet",
    body: "When GreenHaven has real profiles matching your preferences, they will appear here.",
  }
}
