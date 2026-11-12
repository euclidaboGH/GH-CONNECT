/**
 * Phase 4 — Controlled reward-source adapters for the unified PI earnings ledger.
 *
 * Policy:
 * - Default DENY. Credits only when PI_EARNINGS_ADAPTERS_ENABLED=true and Testnet gates pass.
 * - Never trusts client amounts as authority without server caps.
 * - Never rewards self-interaction, missing references, or open-ended view farming.
 * - Every decision is audited (credited | denied | duplicate).
 * - Does not reopen GHC issuance (still locked to Daily Claim policy).
 */
import { readGhcServerEnv, hasPrivilegedDatabase } from "@/lib/server/economy/env"
import { resolvePiSandbox } from "@/lib/pi-env"
import { postEarningsCredit, PI_ATOMIC_SCALE } from "@/lib/server/earnings/unified-ledger"

export type RewardSourceKind =
  | "activity_reward"
  | "creator_earning"
  | "referral"
  | "promotion"
  | "community"
  | "utility"
  | "system"

export type AdapterDecision = {
  ok: boolean
  outcome: "credited" | "denied" | "duplicate"
  denyReason?: string
  amountAtomic?: number
  entryId?: string
  attemptId?: string
  policyEnabled?: boolean
}

/** Per-source daily cap in atomic PI (0 = no credits for that source even when enabled). */
const DAILY_CAPS_ATOMIC: Record<RewardSourceKind, number> = {
  activity_reward: 5 * PI_ATOMIC_SCALE, // 5 PI / day max when enabled
  creator_earning: 50 * PI_ATOMIC_SCALE,
  referral: 10 * PI_ATOMIC_SCALE,
  promotion: 20 * PI_ATOMIC_SCALE,
  community: 5 * PI_ATOMIC_SCALE,
  utility: 10 * PI_ATOMIC_SCALE,
  system: 100 * PI_ATOMIC_SCALE,
}

/** Max single credit per reference */
const MAX_SINGLE_ATOMIC: Record<RewardSourceKind, number> = {
  activity_reward: 1 * PI_ATOMIC_SCALE,
  creator_earning: 25 * PI_ATOMIC_SCALE,
  referral: 5 * PI_ATOMIC_SCALE,
  promotion: 10 * PI_ATOMIC_SCALE,
  community: 2 * PI_ATOMIC_SCALE,
  utility: 5 * PI_ATOMIC_SCALE,
  system: 50 * PI_ATOMIC_SCALE,
}

function adaptersEnabled(): boolean {
  return (
    String(process.env.PI_EARNINGS_ADAPTERS_ENABLED || "").trim() === "true" &&
    String(process.env.PI_A2U_TESTNET_ONLY || "").trim() === "true" &&
    resolvePiSandbox() === true
  )
}

async function rpc<T extends Record<string, unknown>>(
  name: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  if (!hasPrivilegedDatabase()) return null
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })
    const result = (await response.json().catch(() => null)) as T | null
    if (!response.ok || result === null) return null
    return result
  } catch {
    return null
  }
}

async function recordAttempt(input: {
  userId: string
  sourceKind: RewardSourceKind
  referenceId: string
  outcome: "credited" | "denied" | "duplicate"
  amountAtomic?: number
  denyReason?: string
  ledgerEntryId?: string
  actorId?: string
  metadata?: Record<string, unknown>
}): Promise<{ attemptId?: string; duplicate?: boolean } | null> {
  const result = await rpc<{
    ok?: boolean
    attemptId?: string
    duplicate?: boolean
  }>("gh_earnings_reward_record_attempt", {
    p_user_id: input.userId,
    p_source_kind: input.sourceKind,
    p_reference_id: input.referenceId,
    p_outcome: input.outcome,
    p_amount_atomic: input.amountAtomic || 0,
    p_deny_reason: input.denyReason || null,
    p_ledger_entry_id: input.ledgerEntryId || null,
    p_actor_id: input.actorId || null,
    p_metadata: input.metadata || {},
  })
  if (!result?.ok) return null
  return { attemptId: result.attemptId, duplicate: result.duplicate === true }
}

async function dayCredited(userId: string, sourceKind: RewardSourceKind): Promise<number | null> {
  const result = await rpc<{ /** rpc returns numeric scalar sometimes */ } & Record<string, unknown>>(
    "gh_earnings_reward_day_credited",
    { p_user_id: userId, p_source_kind: sourceKind },
  )
  // PostgREST may return bare number
  if (result == null) return null
  if (typeof result === "number") return result
  const n = Number((result as { gh_earnings_reward_day_credited?: number })?.gh_earnings_reward_day_credited ?? result)
  return Number.isFinite(n) ? n : 0
}

function deny(
  reason: string,
  extra?: Partial<AdapterDecision>,
): AdapterDecision {
  return { ok: false, outcome: "denied", denyReason: reason, policyEnabled: adaptersEnabled(), ...extra }
}

/**
 * Evaluate eligibility and optionally credit the unified PI earnings ledger.
 * Callers must pass a stable server-side referenceId (payment id, entitlement id, verified event id).
 */
export async function evaluateAndCreditReward(input: {
  userId: string
  sourceKind: RewardSourceKind
  referenceId: string
  /** Requested atomic amount; clamped by source caps */
  amountAtomic: number
  /** Optional counterparty for self-interaction guard */
  counterpartyId?: string
  actorId?: string
  reason?: string
  metadata?: Record<string, unknown>
}): Promise<AdapterDecision> {
  const userId = String(input.userId || "").trim()
  const referenceId = String(input.referenceId || "").trim()
  const sourceKind = input.sourceKind
  const counterpartyId = input.counterpartyId ? String(input.counterpartyId).trim() : ""

  if (!userId || !referenceId || referenceId.length > 200) {
    return deny("INVALID_INPUT")
  }
  if (!Number.isFinite(input.amountAtomic) || input.amountAtomic <= 0 || !Number.isInteger(input.amountAtomic)) {
    const d = deny("INVALID_AMOUNT")
    await recordAttempt({
      userId, sourceKind, referenceId, outcome: "denied", denyReason: "INVALID_AMOUNT", actorId: input.actorId,
    })
    return d
  }

  // Fraud: self-interaction never earns
  if (counterpartyId && counterpartyId === userId) {
    await recordAttempt({
      userId, sourceKind, referenceId, outcome: "denied", denyReason: "SELF_INTERACTION_DENIED", actorId: input.actorId,
      metadata: input.metadata,
    })
    return deny("SELF_INTERACTION_DENIED")
  }

  if (!adaptersEnabled()) {
    await recordAttempt({
      userId, sourceKind, referenceId, outcome: "denied", denyReason: "ADAPTERS_DISABLED",
      amountAtomic: 0, actorId: input.actorId, metadata: input.metadata,
    })
    return deny("ADAPTERS_DISABLED")
  }

  const maxSingle = MAX_SINGLE_ATOMIC[sourceKind]
  const amountAtomic = Math.min(Math.floor(input.amountAtomic), maxSingle)
  if (amountAtomic <= 0) {
    await recordAttempt({
      userId, sourceKind, referenceId, outcome: "denied", denyReason: "AMOUNT_BELOW_MINIMUM", actorId: input.actorId,
    })
    return deny("AMOUNT_BELOW_MINIMUM")
  }

  const already = await dayCredited(userId, sourceKind)
  if (already == null) {
    return deny("REWARD_AUDIT_UNAVAILABLE")
  }
  const cap = DAILY_CAPS_ATOMIC[sourceKind]
  if (already + amountAtomic > cap) {
    await recordAttempt({
      userId, sourceKind, referenceId, outcome: "denied", denyReason: "DAILY_CAP_EXCEEDED",
      amountAtomic: 0, actorId: input.actorId, metadata: { already, cap },
    })
    return deny("DAILY_CAP_EXCEEDED", { amountAtomic: 0 })
  }

  const uniqueRef = `adapter:${sourceKind}:${referenceId}`
  const ledgerSourceKind = ((): "activity_reward" | "creator_earning" | "adjustment" | "system" => {
    switch (sourceKind) {
      case "creator_earning":
        return "creator_earning"
      case "promotion":
        return "adjustment"
      case "utility":
      case "system":
        return "system"
      case "activity_reward":
      case "referral":
      case "community":
      default:
        return "activity_reward"
    }
  })()
  const credited = await postEarningsCredit({
    userId,
    amountAtomic,
    sourceKind: ledgerSourceKind,
    uniqueRef,
    status: "available",
    sourceTable: "gh_earnings_reward_attempts",
    sourceId: referenceId,
    reason: input.reason || `adapter:${sourceKind}`,
    metadata: { ...(input.metadata || {}), adapter: sourceKind },
  })

  if (!credited.ok) {
    await recordAttempt({
      userId, sourceKind, referenceId, outcome: "denied",
      denyReason: credited.error || "LEDGER_CREDIT_FAILED", actorId: input.actorId,
    })
    return deny(credited.error || "LEDGER_CREDIT_FAILED")
  }

  if (credited.duplicate) {
    await recordAttempt({
      userId, sourceKind, referenceId, outcome: "duplicate",
      amountAtomic, ledgerEntryId: credited.entryId, actorId: input.actorId,
    })
    return {
      ok: true,
      outcome: "duplicate",
      amountAtomic,
      entryId: credited.entryId,
      policyEnabled: true,
    }
  }

  const attempt = await recordAttempt({
    userId, sourceKind, referenceId, outcome: "credited",
    amountAtomic, ledgerEntryId: credited.entryId, actorId: input.actorId, metadata: input.metadata,
  })

  return {
    ok: true,
    outcome: "credited",
    amountAtomic,
    entryId: credited.entryId,
    attemptId: attempt?.attemptId,
    policyEnabled: true,
  }
}

export function getRewardAdapterPolicy() {
  return {
    enabled: adaptersEnabled(),
    testnetOnly: true,
    dailyCapsAtomic: DAILY_CAPS_ATOMIC,
    maxSingleAtomic: MAX_SINGLE_ATOMIC,
    ghcIssuance: "DAILY_CLAIM_ONLY",
    notes: [
      "Self-interactions denied",
      "Stable reference_id required",
      "Credits require PI_EARNINGS_ADAPTERS_ENABLED=true with Testnet sandbox",
    ],
  }
}
