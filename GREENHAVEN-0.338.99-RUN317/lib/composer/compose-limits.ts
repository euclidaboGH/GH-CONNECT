/**
 * Single source of truth for compose limits — keep UI and publish guards aligned.
 */
export const COMPOSE_LIMITS = {
  postTextMax: 5000,
  storyTextMax: 500,
  maxImagesPerPost: 10,
  maxVideoPerPost: 1,
  maxDocPerPost: 1,
  /** Soft warning when remaining characters drop below this */
  textWarnRemaining: 120,
  autosaveMs: 400,
  focusDelayMs: 80,
} as const

export function textMaxForMode(mode: "post" | "story"): number {
  return mode === "story" ? COMPOSE_LIMITS.storyTextMax : COMPOSE_LIMITS.postTextMax
}
