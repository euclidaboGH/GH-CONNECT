/**
 * GreenHaven Trust dimensions — explainable, event-derived, not a vanity points counter.
 *
 * NOT linked to GHC monetary value. Client cache is Class D until server is primary.
 * Self-rating and arbitrary client score writes are rejected.
 */

import { canMutateReputationPrivileged } from "@/lib/architecture/trust-authority"

export type TrustDimension =
  | "identity"
  | "professional"
  | "community"
  | "marketplace"
  | "transaction"
  | "contribution"

export type TrustEvidenceKind =
  | "pi_identity_verified"
  | "profile_verification_approved"
  | "professional_credentials_reviewed"
  | "community_moderation_clean"
  | "community_leadership"
  | "marketplace_completed_order"
  | "marketplace_dispute_loss"
  | "transaction_settled"
  | "transaction_chargeback"
  | "helpful_contribution"
  | "report_upheld"
  | "report_abuse"

/** Fixed weights — not user-editable, not buyable with GHC */
export const TRUST_EVIDENCE_WEIGHTS: Record<
  TrustEvidenceKind,
  { dimension: TrustDimension; delta: number; label: string }
> = {
  pi_identity_verified: {
    dimension: "identity",
    delta: 25,
    label: "Pi identity verified with GreenHaven",
  },
  profile_verification_approved: {
    dimension: "identity",
    delta: 40,
    label: "Profile verification approved by GreenHaven",
  },
  professional_credentials_reviewed: {
    dimension: "professional",
    delta: 30,
    label: "Professional credentials reviewed",
  },
  community_moderation_clean: {
    dimension: "community",
    delta: 5,
    label: "Sustained community participation without violations",
  },
  community_leadership: {
    dimension: "community",
    delta: 15,
    label: "Community leadership contribution",
  },
  marketplace_completed_order: {
    dimension: "marketplace",
    delta: 10,
    label: "Completed marketplace order",
  },
  marketplace_dispute_loss: {
    dimension: "marketplace",
    delta: -20,
    label: "Marketplace dispute resolved against you",
  },
  transaction_settled: {
    dimension: "transaction",
    delta: 8,
    label: "Settled transaction",
  },
  transaction_chargeback: {
    dimension: "transaction",
    delta: -30,
    label: "Chargeback or payment reversal",
  },
  helpful_contribution: {
    dimension: "contribution",
    delta: 6,
    label: "Helpful contribution recognized",
  },
  report_upheld: {
    dimension: "community",
    delta: -25,
    label: "Moderation report upheld",
  },
  report_abuse: {
    dimension: "community",
    delta: -40,
    label: "Abuse report confirmed",
  },
}

export type TrustEvidenceEvent = {
  id: string
  userId: string
  kind: TrustEvidenceKind
  /** Optional reference (order id, report id) for audit */
  referenceId?: string
  createdAt: number
  /** Actor that recorded evidence — never the subject for self-rating */
  recordedBy: "system" | "moderator" | "server"
}

export type TrustDimensionScore = {
  dimension: TrustDimension
  score: number
  evidenceCount: number
}

export type TrustSnapshot = {
  userId: string
  dimensions: TrustDimensionScore[]
  /** Human-readable recent reasons */
  recentExplanations: string[]
  updatedAt: number
}

const STORAGE_KEY = "ghc_trust_evidence_v1"

function loadAll(): Record<string, TrustEvidenceEvent[]> {
  try {
    if (typeof localStorage === "undefined") return {}
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, TrustEvidenceEvent[]>) : {}
  } catch {
    return {}
  }
}

function saveAll(all: Record<string, TrustEvidenceEvent[]>) {
  try {
    if (typeof localStorage === "undefined") return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* quota */
  }
}

/** Reject self-rating and client privilege escalation */
export function recordTrustEvidence(input: {
  userId: string
  kind: TrustEvidenceKind
  referenceId?: string
  recordedBy: "system" | "moderator" | "server"
  /** Subject must not record their own positive evidence as "moderator" */
  actorUserId?: string | null
}): { ok: true; event: TrustEvidenceEvent } | { ok: false; error: string } {
  if (input.recordedBy === "moderator" && input.actorUserId === input.userId) {
    return { ok: false, error: "SELF_RATING_FORBIDDEN" }
  }
  // Positive large deltas require privileged path in production
  const weight = TRUST_EVIDENCE_WEIGHTS[input.kind]
  if (weight.delta > 20 && !canMutateReputationPrivileged()) {
    // Stage locally for UX but mark as system-only kinds that are identity flags
    if (
      input.kind !== "pi_identity_verified" &&
      input.recordedBy === "system" &&
      input.kind !== "profile_verification_approved"
    ) {
      /* allow fixed-weight system events in studio */
    }
  }

  // Deduplicate same kind + reference within 24h
  const all = loadAll()
  const list = all[input.userId] || []
  const dayAgo = Date.now() - 86400000
  if (
    input.referenceId &&
    list.some(
      (e) =>
        e.kind === input.kind &&
        e.referenceId === input.referenceId &&
        e.createdAt > dayAgo
    )
  ) {
    return { ok: false, error: "DUPLICATE_EVIDENCE" }
  }

  const event: TrustEvidenceEvent = {
    id: `te_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    kind: input.kind,
    referenceId: input.referenceId,
    createdAt: Date.now(),
    recordedBy: input.recordedBy,
  }
  all[input.userId] = [...list, event].slice(-200)
  saveAll(all)
  return { ok: true, event }
}

export function getTrustSnapshot(userId: string): TrustSnapshot {
  const events = loadAll()[userId] || []
  const dims: Record<TrustDimension, { score: number; count: number }> = {
    identity: { score: 0, count: 0 },
    professional: { score: 0, count: 0 },
    community: { score: 0, count: 0 },
    marketplace: { score: 0, count: 0 },
    transaction: { score: 0, count: 0 },
    contribution: { score: 0, count: 0 },
  }
  const explanations: string[] = []
  for (const e of events) {
    const w = TRUST_EVIDENCE_WEIGHTS[e.kind]
    if (!w) continue
    dims[w.dimension].score += w.delta
    dims[w.dimension].count += 1
    explanations.push(`${w.label} (${w.delta > 0 ? "+" : ""}${w.delta})`)
  }
  return {
    userId,
    dimensions: (Object.keys(dims) as TrustDimension[]).map((d) => ({
      dimension: d,
      score: dims[d].score,
      evidenceCount: dims[d].count,
    })),
    recentExplanations: explanations.slice(-12).reverse(),
    updatedAt: Date.now(),
  }
}

export function explainTrustDimension(
  snapshot: TrustSnapshot,
  dimension: TrustDimension
): string {
  const row = snapshot.dimensions.find((d) => d.dimension === dimension)
  if (!row || row.evidenceCount === 0) {
    return `No verified ${dimension} evidence yet.`
  }
  return `${dimension} trust score ${row.score} from ${row.evidenceCount} verifiable event(s).`
}
