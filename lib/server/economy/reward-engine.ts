/**
 * GHC reward evaluation contract.
 *
 * Phase 6 policy intentionally disables generic emission. Daily Claim uses its
 * dedicated atomic RPC and 48-hour pending-entitlement lifecycle; peer transfers
 * redistribute existing ledger value and are not reward issuance.
 *
 * Keep this guard at the domain boundary as well as the HTTP route so internal
 * callers cannot accidentally restore activity/achievement/referral issuance.
 */
export type EvaluateRewardInput = {
  userId: string
  sourceEvent: string
  referenceId: string
  targetId?: string
  metadata?: Record<string, unknown>
}

export type EvaluateRewardResult =
  | {
      ok: true
      amount: number
      ruleId: string
      holdId: string
      requiresValidation: boolean
      idempotent?: boolean
      transaction?: unknown
      economicVersion?: string
      m?: number
      g?: number
      deniedReasons?: never
    }
  | {
      ok: false
      error: string
      deniedReasons?: string[]
    }

export async function evaluateRewardAuthoritative(
  input: EvaluateRewardInput
): Promise<EvaluateRewardResult> {
  if (!String(input.userId || "").trim()) {
    return { ok: false, error: "INVALID_USER", deniedReasons: ["USER_REQUIRED"] }
  }
  if (!String(input.sourceEvent || "").trim()) {
    return { ok: false, error: "SOURCE_EVENT_REQUIRED" }
  }
  if (!String(input.referenceId || "").trim()) {
    return { ok: false, error: "REFERENCE_REQUIRED" }
  }
  return {
    ok: false,
    error: "GHC_ISSUANCE_POLICY_LOCKED",
    deniedReasons: ["DAILY_CLAIM_ONLY_ISSUANCE"],
  }
}
