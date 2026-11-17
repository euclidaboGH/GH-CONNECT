export type ProfileIdentitySnapshot = {
  followers: number
  following: number
  level: number
  levelName: string
  points: number
  progress: number
  achievements: number
  durable: boolean
}

type JsonRecord = Record<string, unknown>

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} response is invalid`)
  }
  const row = value as JsonRecord
  if (row.ok !== true) throw new Error(String(row.error || `${label} unavailable`))
  return row
}

function finiteNonNegative(value: unknown, label: string): number {
  const parsed = typeof value === "number" || (typeof value === "string" && value.trim() !== "") ? Number(value) : Number.NaN
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} is invalid`)
  return parsed
}

/** Build the profile identity panel only from three valid API contracts. */
export function parseProfileIdentitySnapshot(
  followsValue: unknown,
  reputationValue: unknown,
  achievementsValue: unknown,
): ProfileIdentitySnapshot {
  const follows = record(followsValue, "Identity graph")
  const reputation = record(reputationValue, "Reputation")
  const achievements = record(achievementsValue, "Achievements")
  if (!Array.isArray(achievements.achievements)) throw new Error("Achievements response is invalid")
  if (typeof reputation.levelName !== "string" || !reputation.levelName.trim()) {
    throw new Error("Reputation level is invalid")
  }
  const level = finiteNonNegative(reputation.level, "Reputation level")
  if (level < 1) throw new Error("Reputation level is invalid")
  const progress = finiteNonNegative(reputation.progressRatio, "Reputation progress")
  if (progress > 1) throw new Error("Reputation progress is invalid")
  return {
    followers: finiteNonNegative(follows.followersCount, "Follower count"),
    following: finiteNonNegative(follows.followingCount, "Following count"),
    level,
    levelName: reputation.levelName.trim(),
    points: finiteNonNegative(reputation.totalPoints, "Reputation points"),
    progress,
    achievements: achievements.achievements.length,
    // Unknown/missing durability is never promoted to a server-confirmed state.
    durable: follows.durable === true && reputation.durable === true && achievements.durable === true,
  }
}
