/**
 * Testnet / pre-mainnet unlock spine.
 * When sandbox or explicit unlock is on, economy surfaces that are safe on testnet
 * run end-to-end so the full product can be exercised before mainnet.
 *
 * Mainnet remains locked unless the same flags are set deliberately in production.
 * Never mints on client; all credits still go through server RPCs / store.
 */

function envTrue(name: string): boolean {
  try {
    const v = String(process.env[name] || "").trim().toLowerCase()
    return v === "1" || v === "true" || v === "yes" || v === "on"
  } catch {
    return false
  }
}

/** Explicit operator unlock (Vercel: GHC_TESTNET_UNLOCK=1). */
export function isExplicitTestnetUnlock(): boolean {
  return envTrue("GHC_TESTNET_UNLOCK") || envTrue("NEXT_PUBLIC_GHC_TESTNET_UNLOCK")
}

/** Pi sandbox / testnet network. */
export function isPiSandboxEnv(): boolean {
  if (envTrue("NEXT_PUBLIC_PI_SANDBOX")) return true
  if (String(process.env.PI_ENV || "").toLowerCase() === "sandbox") return true
  // Vercel Preview is treated as non-mainnet for product exercise
  if (String(process.env.VERCEL_ENV || "").toLowerCase() === "preview") return true
  return false
}

/**
 * Full product exercise mode: sandbox OR explicit unlock.
 * Use for activity rewards, curation redistribute, Pi→GHC packs, marketplace fees.
 */
export function isTestnetProductUnlocked(): boolean {
  return isExplicitTestnetUnlock() || isPiSandboxEnv()
}

export function activityRewardsEnabled(): boolean {
  if (envTrue("GHC_ACTIVITY_REWARDS_ENABLED")) return true
  return isTestnetProductUnlocked()
}

export function curationRedistributeEnabled(): boolean {
  if (
    envTrue("GHC_CURATION_REDISTRIBUTE_ENABLED") ||
    envTrue("NEXT_PUBLIC_GHC_CURATION_REDISTRIBUTE_ENABLED")
  ) {
    return true
  }
  return isTestnetProductUnlocked()
}

export function referralSettlementEnabled(): boolean {
  if (
    envTrue("GHC_REFERRAL_SETTLEMENT_ENABLED") ||
    envTrue("NEXT_PUBLIC_GHC_REFERRAL_SETTLEMENT_ENABLED")
  ) {
    return true
  }
  return isTestnetProductUnlocked()
}

export function buyGhcWithPiEnabled(): boolean {
  if (envTrue("GHC_BUY_WITH_PI_ENABLED")) return true
  return isTestnetProductUnlocked()
}

export function testnetUnlockSnapshot() {
  return {
    explicitUnlock: isExplicitTestnetUnlock(),
    piSandbox: isPiSandboxEnv(),
    productUnlocked: isTestnetProductUnlocked(),
    activityRewards: activityRewardsEnabled(),
    curationRedistribute: curationRedistributeEnabled(),
    referralSettlement: referralSettlementEnabled(),
    buyGhcWithPi: buyGhcWithPiEnabled(),
  }
}
