/**
 * Lightweight regression guards for GreenHaven.
 */

import { asArray } from "@/lib/safe-data"

export function assertMutualMatchShape(match: unknown): boolean {
  if (!match || typeof match !== "object") return false
  const m = match as { userId?: unknown; id?: unknown }
  const id = m.userId || m.id
  return typeof id === "string" && id.length > 0
}

export function filterValidMatches(matches: unknown): unknown[] {
  return asArray(matches).filter(function (m: unknown) {
    return assertMutualMatchShape(m)
  })
}

const FORBIDDEN_ECONOMY = /\b(roi|yield|apr|apy|invest|profit|dividend|interest rate)\b/i

export function sanitizeEconomyCopy(text: string | null | undefined): string | null | undefined {
  if (!text || !FORBIDDEN_ECONOMY.test(text)) return text
  return text
    .replace(/\bROI\b/gi, "activity")
    .replace(/\byield\b/gi, "credit")
    .replace(/\bprofit\b/gi, "balance change")
    .replace(/\binvest(?:ment|ing)?\b/gi, "utility use")
}
