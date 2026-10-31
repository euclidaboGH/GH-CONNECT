/**
 * Phase 10 — Reputation display helpers (presentation only).
 * Never invents points, levels, or tiers. Only formats values already provided.
 */

export type ReputationDisplayInput = {
  level?: number | null
  levelName?: string | null
  totalPoints?: number | null
  tier?: string | null
}

/** Compact chip text when server/domain data exists */
export function formatReputationChip(input: ReputationDisplayInput): string | null {
  const level = typeof input.level === "number" && input.level > 0 ? input.level : null
  const name = typeof input.levelName === "string" && input.levelName.trim() ? input.levelName.trim() : null
  const tier = typeof input.tier === "string" && input.tier.trim() ? input.tier.trim() : null
  if (name && level) return `L${level} · ${name}`
  if (name) return name
  if (level) return `L${level}`
  if (tier && tier.toLowerCase() !== "new") return tier.charAt(0).toUpperCase() + tier.slice(1)
  return null
}

export function formatReputationPoints(points: number | null | undefined): string | null {
  if (typeof points !== "number" || !Number.isFinite(points) || points < 0) return null
  return points.toLocaleString()
}

/** Read optional author reputation fields from a post object without inventing */
export function authorReputationFromPost(post: {
  authorReputationLevel?: unknown
  authorReputationName?: unknown
  authorRepLevel?: unknown
  authorRepName?: unknown
  authorReputationTier?: unknown
}): ReputationDisplayInput | null {
  const levelRaw = post.authorReputationLevel ?? post.authorRepLevel
  const nameRaw = post.authorReputationName ?? post.authorRepName
  const tierRaw = post.authorReputationTier
  const level = typeof levelRaw === "number" && Number.isFinite(levelRaw) ? levelRaw : null
  const levelName = typeof nameRaw === "string" ? nameRaw : null
  const tier = typeof tierRaw === "string" ? tierRaw : null
  if (level == null && !levelName && !tier) return null
  return { level, levelName, tier }
}
