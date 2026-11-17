/**
 * Client helpers for Ecosystem Directory Staking signal (product only).
 * Server remains authority; amounts from this module must not authorize finance.
 */

export type StakeTierId = "none" | "supporter" | "advocate" | "champion"

export type StakeTier = {
  id: StakeTierId
  label: string
  minEffective: number
}

export const DEFAULT_STAKE_TIERS: StakeTier[] = [
  { id: "supporter", label: "Supporter", minEffective: 1 },
  { id: "advocate", label: "Advocate", minEffective: 100 },
  { id: "champion", label: "Champion", minEffective: 1000 },
]

export type StakingStatus = {
  available: boolean
  reason?: string
  effectiveStake: number | null
  tier: StakeTierId
  tiers: StakeTier[]
  message?: string
}

export function tierFromEffectiveStake(
  amount: number | null | undefined,
  tiers: StakeTier[] = DEFAULT_STAKE_TIERS
): StakeTierId {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return "none"
  const sorted = [...tiers].sort((a, b) => b.minEffective - a.minEffective)
  for (const t of sorted) {
    if (amount >= t.minEffective) return t.id as StakeTierId
  }
  return "none"
}

export async function fetchStakingStatus(
  init?: RequestInit
): Promise<StakingStatus> {
  try {
    const res = await fetch("/api/pi/staking", {
      credentials: "include",
      cache: "no-store",
      ...init,
    })
    const data = (await res.json().catch(() => ({}))) as {
      available?: boolean
      reason?: string
      effectiveStake?: number | null
      message?: string
      tiers?: Array<{ id: string; label: string; minEffective: number }>
    }
    const tiers =
      Array.isArray(data.tiers) && data.tiers.length
        ? data.tiers.map((t) => ({
            id: t.id as StakeTierId,
            label: t.label,
            minEffective: Number(t.minEffective) || 0,
          }))
        : DEFAULT_STAKE_TIERS
    const effective =
      data.effectiveStake != null && Number.isFinite(Number(data.effectiveStake))
        ? Number(data.effectiveStake)
        : null
    return {
      available: Boolean(data.available),
      reason: data.reason,
      effectiveStake: effective,
      tier: tierFromEffectiveStake(effective, tiers),
      tiers,
      message: data.message,
    }
  } catch {
    return {
      available: false,
      reason: "network",
      effectiveStake: null,
      tier: "none",
      tiers: DEFAULT_STAKE_TIERS,
      message: "Could not reach staking status",
    }
  }
}

export function stakeTierLabel(tier: StakeTierId): string {
  switch (tier) {
    case "champion":
      return "Champion"
    case "advocate":
      return "Advocate"
    case "supporter":
      return "Supporter"
    default:
      return ""
  }
}
