/**
 * Phase 2 registration-bonus policy and reconciliation.
 * All amounts and legacy detection are server/database-authoritative.
 */
import { hasPrivilegedDatabase } from "@/lib/server/economy/env"
import {
  PI_ATOMIC_SCALE,
  getRegistrationBonusPolicyStatus,
  claimRegistrationBonusPolicy,
} from "@/lib/server/earnings/unified-ledger"

/** 3 PI total registration bonus at the 1e-7 atomic scale. */
export const REGISTRATION_BONUS_PI = 3
export const REGISTRATION_BONUS_ATOMIC = Math.round(REGISTRATION_BONUS_PI * PI_ATOMIC_SCALE) // 30_000_000
export const REGISTRATION_BONUS_TOPUP_PI = 2.95
export const REGISTRATION_BONUS_TOPUP_ATOMIC = Math.round(REGISTRATION_BONUS_TOPUP_PI * PI_ATOMIC_SCALE) // 29_500_000
export const REGISTRATION_BONUS_POLICY_VERSION = "v2"
export const REGISTRATION_BONUS_SOURCE_KIND = "system" as const

export function registrationBonusUniqueRef(userId: string): string {
  return `registration_bonus:${REGISTRATION_BONUS_POLICY_VERSION}:${String(userId || "").trim()}`
}

/** Legacy v1 claimants receive a separate, idempotent top-up reference. */
export function registrationBonusTopupUniqueRef(userId: string): string {
  return `registration_bonus:v2_topup:${String(userId || "").trim()}`
}

/**
 * Fail-closed feature gate. Bonus credits are enabled only when the operator
 * explicitly enables them AND the deployed Pi app is explicitly configured for
 * Testnet. An unset/invalid network flag never falls through to Mainnet.
 */
export function isRegistrationBonusEnabled(): boolean {
  const enabled = String(process.env.GHC_REGISTRATION_BONUS_ENABLED ?? "0").trim().toLowerCase()
  const sandbox = String(process.env.NEXT_PUBLIC_PI_SANDBOX ?? "").trim().toLowerCase()
  return ["1", "true", "yes", "on"].includes(enabled) && sandbox === "true"
}

export type RegistrationBonusStatus = {
  ok: boolean
  enabled: boolean
  amountPi: number
  amountAtomic: number
  claimable: boolean
  claimed: boolean
  legacyClaimed?: boolean
  duplicate?: boolean
  uniqueRef: string
  error?: string
  reasons: string[]
  message?: string
}

export async function getRegistrationBonusStatus(userId: string): Promise<RegistrationBonusStatus> {
  const uid = String(userId || "").trim()
  const uniqueRef = registrationBonusUniqueRef(uid)
  const base: RegistrationBonusStatus = {
    ok: true, enabled: isRegistrationBonusEnabled(), amountPi: REGISTRATION_BONUS_PI,
    amountAtomic: REGISTRATION_BONUS_ATOMIC, claimable: false, claimed: false,
    uniqueRef, reasons: [],
  }
  if (!uid) return { ...base, ok: false, error: "AUTH_REQUIRED", reasons: ["Sign in required"] }
  if (!base.enabled) return { ...base, reasons: ["Registration bonus is paused"], message: "This one-time PI bonus is currently disabled by the operator." }
  if (!hasPrivilegedDatabase()) return { ...base, ok: false, error: "EARNINGS_LEDGER_UNAVAILABLE", reasons: ["Earnings ledger unavailable"], message: "Could not load the server earnings ledger. No balances were invented." }

  const status = await getRegistrationBonusPolicyStatus(uid)
  if (!status.ok) return { ...base, ok: false, error: status.error || "EARNINGS_LEDGER_UNAVAILABLE", reasons: ["Earnings ledger unavailable"], message: "Could not load the server earnings ledger. No balances were invented." }

  const legacyClaimed = status.legacyClaimed === true
  const claimed = status.claimed === true
  const amountAtomic = status.amountAtomic ?? (legacyClaimed ? REGISTRATION_BONUS_TOPUP_ATOMIC : REGISTRATION_BONUS_ATOMIC)
  const amountPi = status.amountPi ?? amountAtomic / PI_ATOMIC_SCALE
  const isClaimable = status.claimable === true
  return {
    ...base, amountPi, amountAtomic, legacyClaimed, claimed, claimable: isClaimable,
    uniqueRef: status.uniqueRef || (legacyClaimed ? registrationBonusTopupUniqueRef(uid) : uniqueRef),
    reasons: claimed ? ["Registration bonus already reconciled"] : isClaimable ? [] : ["Registration bonus not claimable"],
    message: status.message || (claimed
      ? "Registration bonus is already available in your PI earnings ledger."
      : legacyClaimed
        ? "Your previous 0.05 π bonus is recorded; reconcile the remaining 2.95 π."
        : `Claim your one-time ${REGISTRATION_BONUS_PI} π registration bonus to your PI earnings balance.`),
  }
}

export async function claimRegistrationBonus(userId: string): Promise<RegistrationBonusStatus & { entryId?: string }> {
  const status = await getRegistrationBonusStatus(userId)
  if (!status.ok || !status.enabled || !status.claimable) {
    return { ...status, claimable: false, duplicate: status.claimed === true }
  }
  const result = await claimRegistrationBonusPolicy(String(userId || "").trim())
  if (!result.ok) return { ...status, ok: false, claimable: false, error: result.error || "CREDIT_FAILED", reasons: [result.error || "Could not credit registration bonus"], message: "Registration bonus could not be reconciled. No balance was invented." }
  const amountAtomic = result.amountAtomic ?? status.amountAtomic
  const amountPi = result.amountPi ?? amountAtomic / PI_ATOMIC_SCALE
  return {
    ...status, ok: true, amountAtomic, amountPi, uniqueRef: result.uniqueRef || status.uniqueRef,
    claimed: result.claimed !== false, claimable: false, duplicate: result.duplicate === true,
    legacyClaimed: result.legacyClaimed ?? status.legacyClaimed, entryId: result.entryId,
    reasons: result.duplicate ? ["Registration bonus already reconciled"] : [],
    message: result.message || (result.duplicate ? "Registration bonus already reconciled." : `${amountPi} π registration bonus credit is available in your PI earnings ledger.`),
  }
}
