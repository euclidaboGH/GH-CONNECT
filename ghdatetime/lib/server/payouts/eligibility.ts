/**
 * Phase 4 — seller / creator payout eligibility (server rules).
 * A2U and external payouts must pass these checks before processing.
 */

export type PayoutKind = "seller_marketplace" | "creator_earning" | "refund" | "reward" | "other"

export type PayoutEligibilityInput = {
  kind: PayoutKind
  amount: number
  currency: "PI" | "NGN" | "GHC" | string
  /** Seller or recipient GreenHaven user id */
  recipientUserId: string
  /** Optional order / earning reference */
  sourceReference?: string
  /** When the underlying sale completed */
  sourceCompletedAt?: number
  /** Account flags */
  recipientSuspended?: boolean
  recipientKycOk?: boolean
  hasLinkedPiIdentity?: boolean
}

export type PayoutEligibilityResult =
  | { ok: true; holdDays: number; earliestPayoutAt: number | null; reasons: string[] }
  | { ok: false; code: string; message: string; reasons: string[] }

/** Marketplace seller holds (anti-fraud). Env GHC_SELLER_PAYOUT_HOLD_DAYS default 3. */
export function sellerPayoutHoldDays(): number {
  const n = Number(process.env.GHC_SELLER_PAYOUT_HOLD_DAYS ?? 3)
  if (!Number.isFinite(n) || n < 0) return 3
  return Math.min(30, Math.floor(n))
}

export function maxSinglePayoutPi(): number {
  const n = Number(process.env.GHC_A2U_MAX_SINGLE_PI ?? 100)
  if (!Number.isFinite(n) || n <= 0) return 100
  return n
}

export function evaluatePayoutEligibility(input: PayoutEligibilityInput): PayoutEligibilityResult {
  const reasons: string[] = []
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Payout amount must be positive", reasons: ["invalid_amount"] }
  }
  if (!String(input.recipientUserId || "").trim()) {
    return { ok: false, code: "NO_RECIPIENT", message: "Recipient required", reasons: ["no_recipient"] }
  }
  if (input.recipientSuspended) {
    return {
      ok: false,
      code: "RECIPIENT_SUSPENDED",
      message: "Recipient account is suspended",
      reasons: ["suspended"],
    }
  }

  const currency = String(input.currency || "").toUpperCase()
  if (currency === "GHC") {
    return {
      ok: false,
      code: "GHC_NOT_A2U",
      message: "GHC is internal utility — use ledger transfer/spend, not Pi A2U",
      reasons: ["ghc_not_external_payout"],
    }
  }

  if ((input.kind === "seller_marketplace" || input.kind === "creator_earning") && currency === "PI") {
    if (input.hasLinkedPiIdentity === false) {
      return {
        ok: false,
        code: "PI_IDENTITY_REQUIRED",
        message: "Link a Pi identity before A2U payout",
        reasons: ["no_pi_identity"],
      }
    }
    if (amount > maxSinglePayoutPi()) {
      return {
        ok: false,
        code: "AMOUNT_OVER_CAP",
        message: `Single A2U payout capped at ${maxSinglePayoutPi()} π`,
        reasons: ["over_single_cap"],
      }
    }
  }

  const holdDays = input.kind === "seller_marketplace" ? sellerPayoutHoldDays() : 0
  let earliest: number | null = null
  if (holdDays > 0 && input.sourceCompletedAt && input.sourceCompletedAt > 0) {
    earliest = input.sourceCompletedAt + holdDays * 24 * 60 * 60 * 1000
    if (Date.now() < earliest) {
      reasons.push(`hold_until_${new Date(earliest).toISOString()}`)
      return {
        ok: false,
        code: "HOLD_PERIOD",
        message: `Seller funds on hold for ${holdDays} day(s) after sale completion`,
        reasons,
      }
    }
  }

  if (input.kind === "refund") {
    reasons.push("refund_path")
  }

  return { ok: true, holdDays, earliestPayoutAt: earliest, reasons: reasons.length ? reasons : ["eligible"] }
}

export function payoutPolicyPublic() {
  return {
    sellerHoldDays: sellerPayoutHoldDays(),
    maxSinglePayoutPi: maxSinglePayoutPi(),
    ghcExternalPayout: false,
    note: "Seller marketplace proceeds may be paid in π after hold and identity checks. GHC stays on the internal ledger.",
  }
}
