/**
 * GH Social — allowlisted durable reaction types.
 * Must stay aligned with UI PostReaction and gh_reaction_toggle whitelist.
 */

export const DURABLE_REACTION_TYPES = [
  "like",
  "love",
  "laugh",
  "wow",
  "sad",
  "angry",
  "support",
  "inspire",
  "insight",
  "celebrate",
] as const

export type DurableReactionType = (typeof DURABLE_REACTION_TYPES)[number]

export function isDurableReactionType(value: unknown): value is DurableReactionType {
  return (
    typeof value === "string" &&
    (DURABLE_REACTION_TYPES as readonly string[]).includes(value)
  )
}

export function normalizeReactionType(value: unknown): DurableReactionType {
  if (isDurableReactionType(value)) return value
  return "like"
}
