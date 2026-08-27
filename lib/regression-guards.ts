/**
 * Lightweight regression guards for GH Connect.
 */

import { asArray } from "@/lib/safe-data"

export function assertMutualMatchShape(match) {
  if (!match || typeof match !== "object") return false
  const id = match.userId || match.id
  return typeof id === "string" && id.length > 0
}

export function filterValidMatches(matches) {
  return asArray(matches).filter(function (m) {
    return assertMutualMatchShape(m)
  })
}

const FORBIDDEN_ECONOMY = /\b(roi|yield|apr|apy|invest|profit|dividend|interest rate)\b/i

export function sanitizeEconomyCopy(text) {
  if (!text || !FORBIDDEN_ECONOMY.test(text)) return text
  return text
    .replace(/\bROI\b/gi, "activity")
    .replace(/\byield\b/gi, "credit")
    .replace(/\bprofit\b/gi, "balance change")
    .replace(/\binvest(?:ment|ing)?\b/gi, "utility use")
}
