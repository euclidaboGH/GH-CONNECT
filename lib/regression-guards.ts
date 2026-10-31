/**
 * Lightweight regression guards for GreenHaven.
 */

import { asArray } from "@/lib/safe-data"
import type { MatchEntry } from "@/lib/ghc-types"

function isMatchEntry(match: unknown): match is MatchEntry {
  if (!match || typeof match !== "object") return false
  const m = match as { userId?: unknown; id?: unknown; userName?: unknown; matchedAt?: unknown }
  const id = m.userId || m.id
  return typeof id === "string" && id.length > 0
}

export function assertMutualMatchShape(match: unknown): boolean {
  return isMatchEntry(match)
}

export function filterValidMatches(matches: unknown): MatchEntry[] {
  return asArray(matches).filter(isMatchEntry).map((m) => {
    const row = m as MatchEntry & { id?: string; userId?: string }
    // Normalize id/userId so callers can rely on MatchEntry fields
    const userId = String(row.userId || row.id)
    return {
      id: String(row.id || userId),
      userId,
      userName: row.userName || "Member",
      userPhoto: row.userPhoto || "",
      matchedAt: typeof row.matchedAt === "number" ? row.matchedAt : Date.now(),
      online: Boolean(row.online),
      intentions: row.intentions,
      reasons: row.reasons,
      qualityScore: row.qualityScore,
    }
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
