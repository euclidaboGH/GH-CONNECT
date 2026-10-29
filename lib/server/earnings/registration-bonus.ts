/**
 * One-time PI registration bonus (Testnet giveaway / system test).
 * Credits the unified earnings ledger only — never invents client balances.
 * Withdrawal to linked Pi wallet uses existing A2U / withdrawable paths.
 */
import { hasPrivilegedDatabase } from "@/lib/server/economy/env"
import {
  PI_ATOMIC_SCALE,
  postEarningsCredit,
  getEarningsStatement,
} from "@/lib/server/earnings/unified-ledger"

/** 0.05 PI at 1e-7 atomic scale */
export const REGISTRATION_BONUS_PI = 0.05
export const REGISTRATION_BONUS_ATOMIC = Math.round(REGISTRATION_BONUS_PI * PI_ATOMIC_SCALE) // 500_000
export const REGISTRATION_BONUS_POLICY_VERSION = "v1"
export const REGISTRATION_BONUS_SOURCE_KIND = "system" as const

export function registrationBonusUniqueRef(userId: string): string {
  return `registration_bonus:${REGISTRATION_BONUS_POLICY_VERSION}:${String(userId || "").trim()}`
}

/** Feature flag — default enabled so Testnet can exercise ledger; set 0 to stop giveaway. */
export function isRegistrationBonusEnabled(): boolean {
  const raw = String(process.env.GHC_REGISTRATION_BONUS_ENABLED ?? "1").trim().toLowerCase()
  return raw !== "0" && raw !== "false" && raw !== "off"
}

export type RegistrationBonusStatus = {
  ok: boolean
  enabled: boolean
  amountPi: number
  amountAtomic: number
  claimable: boolean
  claimed: boolean
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
    ok: true,
    enabled: isRegistrationBonusEnabled(),
    amountPi: REGISTRATION_BONUS_PI,
    amountAtomic: REGISTRATION_BONUS_ATOMIC,
    claimable: false,
    claimed: false,
    uniqueRef,
    reasons: [],
  }

  if (!uid) {
    return { ...base, ok: false, error: "AUTH_REQUIRED", reasons: ["Sign in required"] }
  }
  if (!base.enabled) {
    return {
      ...base,
      claimable: false,
      reasons: ["Registration bonus giveaway is paused"],
      message: "This one-time PI bonus is currently disabled by the operator.",
    }
  }
  if (!hasPrivilegedDatabase()) {
    return {
      ...base,
      ok: false,
      error: "EARNINGS_LEDGER_UNAVAILABLE",
      reasons: ["Earnings ledger unavailable"],
      message: "Could not load the server earnings ledger. No balances were invented.",
    }
  }

  const statement = await getEarningsStatement(uid, 50)
  if (!statement.ok) {
    return {
      ...base,
      ok: false,
      error: statement.error || "EARNINGS_LEDGER_UNAVAILABLE",
      reasons: ["Earnings ledger unavailable"],
      message: "Could not load the server earnings ledger. No balances were invented.",
    }
  }

  const claimed = (statement.entries || []).some((raw) => {
    const e = raw as { unique_ref?: string; uniqueRef?: string }
    const ref = String(e.unique_ref || e.uniqueRef || "")
    return ref === uniqueRef
  })

  if (claimed) {
    return {
      ...base,
      claimed: true,
      claimable: false,
      reasons: ["Already claimed"],
      message: "Registration bonus already credited to your PI earnings ledger.",
    }
  }

  return {
    ...base,
    claimable: true,
    claimed: false,
    reasons: [],
    message: `Claim a one-time ${REGISTRATION_BONUS_PI} π registration bonus to your PI earnings balance.`,
  }
}

export async function claimRegistrationBonus(userId: string): Promise<RegistrationBonusStatus & {
  entryId?: string
}> {
  const status = await getRegistrationBonusStatus(userId)
  if (!status.ok) return status
  if (!status.enabled) return { ...status, claimable: false }
  if (status.claimed) {
    return { ...status, claimable: false, duplicate: true }
  }
  if (!status.claimable) return status

  const uniqueRef = status.uniqueRef
  const credit = await postEarningsCredit({
    userId: String(userId).trim(),
    amountAtomic: REGISTRATION_BONUS_ATOMIC,
    sourceKind: REGISTRATION_BONUS_SOURCE_KIND,
    uniqueRef,
    status: "available",
    sourceTable: "registration_bonus",
    sourceId: REGISTRATION_BONUS_POLICY_VERSION,
    reason: "one_time_registration_bonus",
    metadata: {
      policyVersion: REGISTRATION_BONUS_POLICY_VERSION,
      amountPi: REGISTRATION_BONUS_PI,
      giveaway: true,
    },
  })

  if (!credit.ok) {
    return {
      ...status,
      ok: false,
      claimable: false,
      error: credit.error || "CREDIT_FAILED",
      reasons: [credit.error || "Could not credit registration bonus"],
      message: "Registration bonus could not be credited. No balance was invented.",
    }
  }

  return {
    ...status,
    ok: true,
    claimed: true,
    claimable: false,
    duplicate: credit.duplicate === true,
    entryId: credit.entryId,
    reasons: credit.duplicate ? ["Already claimed"] : [],
    message: credit.duplicate
      ? "Registration bonus already credited."
      : `${REGISTRATION_BONUS_PI} π registration bonus is now available in your PI earnings ledger.`,
  }
}
