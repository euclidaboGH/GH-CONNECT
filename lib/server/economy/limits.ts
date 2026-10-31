/**
 * Single authoritative server-side limit source (mirrors DEFAULT_ECONOMY_LIMITS).
 * Do not scatter hardcodes across API routes.
 */
import { DEFAULT_ECONOMY_LIMITS, type EconomyLimits } from "@/lib/domains/economy-types"

export function getServerEconomyLimits(): EconomyLimits {
  return { ...DEFAULT_ECONOMY_LIMITS }
}
