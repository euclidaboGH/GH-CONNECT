/**
 * Phase 2.3 — content attention helpers (measurement only, no economy).
 * Spec: docs/GH_ATTENTION.md
 */

export const ATTENTION_EVENT_TYPES = [
  "view",
  "qualified_view",
  "complete",
  "save",
  "share",
] as const

export type AttentionEventType = (typeof ATTENTION_EVENT_TYPES)[number]

/** Max dwell accepted from client (ms) — prevents absurd values */
export const ATTENTION_MAX_DWELL_MS = 600_000

/** Minimum dwell for qualified_view when client sends dwellMs */
export const QUALIFIED_VIEW_MIN_DWELL_MS = 3_000

export function isAttentionEventType(v: unknown): v is AttentionEventType {
  return typeof v === "string" && (ATTENTION_EVENT_TYPES as readonly string[]).includes(v)
}

/**
 * Dedup window keys (server-computed; client window ignored for authority).
 * - view: UTC calendar day (simple, stable)
 * - qualified_view: UTC calendar day
 * - complete: lifetime once per post
 * - save / share: UTC calendar day
 */
export function attentionWindowKey(eventType: AttentionEventType, now = new Date()): string {
  const day = now.toISOString().slice(0, 10) // YYYY-MM-DD UTC
  if (eventType === "complete") return "once"
  return day
}

export function clampDwellMs(raw: unknown): number | undefined {
  if (raw == null) return undefined
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return undefined
  return Math.min(Math.floor(n), ATTENTION_MAX_DWELL_MS)
}
