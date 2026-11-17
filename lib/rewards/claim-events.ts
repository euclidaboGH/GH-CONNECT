/**
 * Canonical rewards claim → wallet/rewards refresh events.
 */

export const REWARD_CLAIMED_EVENT = "ghc:reward-claimed"
export const REWARDS_REFRESH_EVENT = "ghc:rewards-refresh"
export const DAILY_REWARD_CLAIMED_EVENT = "ghc:daily-reward-claimed"
export const WALLET_REFRESH_EVENT = "ghc:wallet-refresh"

export function emitRewardClaimed(detail?: { source?: string; amount?: number }): void {
  if (typeof window === "undefined") return
  try {
    window.dispatchEvent(new CustomEvent(REWARD_CLAIMED_EVENT, { detail: detail || {} }))
    window.dispatchEvent(new CustomEvent(REWARDS_REFRESH_EVENT, { detail: detail || {} }))
    window.dispatchEvent(new CustomEvent(WALLET_REFRESH_EVENT, { detail: { reason: "reward-claim" } }))
  } catch { /* */ }
}

export function emitDailyRewardClaimed(detail?: { idempotent?: boolean }): void {
  if (typeof window === "undefined") return
  try {
    window.dispatchEvent(new CustomEvent(DAILY_REWARD_CLAIMED_EVENT, { detail: detail || {} }))
    emitRewardClaimed({ source: "daily" })
  } catch { /* */ }
}
