/**
 * GreenHaven anti-abuse / risk engine — graduated responses.
 * Does not permanently ban on a single weak signal.
 * Does not use sensitive personal characteristics.
 * Does not modify GHC ledger or Pi settlement.
 */

export type RiskSurface =
  | "registration"
  | "authentication"
  | "referral"
  | "ghc_reward"
  | "messaging"
  | "follow"
  | "reaction"
  | "marketplace"
  | "payment"
  | "community"
  | "verification"
  | "search"
  | "upload"

export type RiskDecision =
  | "ALLOW"
  | "WARN"
  | "THROTTLE"
  | "CHALLENGE"
  | "TEMPORARILY_RESTRICT"
  | "REQUIRE_VERIFICATION"
  | "BLOCK"
  | "ESCALATE_TO_MODERATION"

export type RiskSignal = {
  code: string
  weight: number
  surface: RiskSurface
  detail?: string
}

export type RiskEvaluation = {
  decision: RiskDecision
  score: number
  signals: RiskSignal[]
  /** Safe for logs / user-facing restriction reason */
  reason: string
  retryAfterMs?: number
}

type Bucket = { count: number; windowStart: number }

const g = globalThis as unknown as {
  __ghRiskBuckets?: Map<string, Bucket>
  __ghRiskAudit?: Array<{ at: number; key: string; decision: RiskDecision; reason: string }>
}

function buckets(): Map<string, Bucket> {
  if (!g.__ghRiskBuckets) g.__ghRiskBuckets = new Map()
  return g.__ghRiskBuckets
}

function audit(): Array<{ at: number; key: string; decision: RiskDecision; reason: string }> {
  if (!g.__ghRiskAudit) g.__ghRiskAudit = []
  return g.__ghRiskAudit
}

function hit(key: string, windowMs: number): number {
  const now = Date.now()
  const b = buckets().get(key)
  if (!b || now - b.windowStart > windowMs) {
    buckets().set(key, { count: 1, windowStart: now })
    return 1
  }
  b.count += 1
  return b.count
}

/**
 * Evaluate action risk. Call from server routes preferentially;
 * client use is advisory only.
 */
export function evaluateRisk(input: {
  surface: RiskSurface
  actorKey: string
  /** Optional signals from caller (duplicates, velocity, etc.) */
  extraSignals?: RiskSignal[]
}): RiskEvaluation {
  const signals: RiskSignal[] = [...(input.extraSignals || [])]
  const key = `${input.surface}:${input.actorKey}`

  // Velocity windows
  const per10s = hit(`${key}:10s`, 10_000)
  const perMin = hit(`${key}:1m`, 60_000)
  const perHour = hit(`${key}:1h`, 3_600_000)

  const limits: Record<RiskSurface, { soft: number; hard: number; hour: number }> = {
    registration: { soft: 3, hard: 8, hour: 20 },
    authentication: { soft: 8, hard: 20, hour: 60 },
    referral: { soft: 5, hard: 15, hour: 40 },
    ghc_reward: { soft: 6, hard: 15, hour: 50 },
    messaging: { soft: 20, hard: 60, hour: 300 },
    follow: { soft: 15, hard: 40, hour: 120 },
    reaction: { soft: 40, hard: 120, hour: 500 },
    marketplace: { soft: 10, hard: 30, hour: 80 },
    payment: { soft: 5, hard: 12, hour: 30 },
    community: { soft: 15, hard: 40, hour: 150 },
    verification: { soft: 3, hard: 8, hour: 15 },
    search: { soft: 30, hard: 90, hour: 400 },
    upload: { soft: 8, hard: 20, hour: 60 },
  }

  const lim = limits[input.surface]
  if (per10s > lim.soft) {
    signals.push({
      code: "VELOCITY_BURST",
      weight: 15,
      surface: input.surface,
      detail: `${per10s} actions / 10s`,
    })
  }
  if (perMin > lim.hard) {
    signals.push({
      code: "VELOCITY_HIGH",
      weight: 35,
      surface: input.surface,
      detail: `${perMin} actions / min`,
    })
  }
  if (perHour > lim.hour) {
    signals.push({
      code: "VELOCITY_SUSTAINED",
      weight: 40,
      surface: input.surface,
      detail: `${perHour} actions / hour`,
    })
  }

  const score = signals.reduce((s, x) => s + x.weight, 0)

  let decision: RiskDecision = "ALLOW"
  let retryAfterMs: number | undefined
  let reason = "ok"

  if (score >= 90) {
    decision = "ESCALATE_TO_MODERATION"
    reason = "Multiple strong risk signals — escalated for human review (not a permanent ban)."
  } else if (score >= 70) {
    decision = "BLOCK"
    reason = "Temporarily blocked due to abusive velocity or pattern."
    retryAfterMs = 15 * 60_000
  } else if (score >= 55) {
    decision = "REQUIRE_VERIFICATION"
    reason = "Additional verification required before continuing this action."
  } else if (score >= 40) {
    decision = "TEMPORARILY_RESTRICT"
    reason = "Temporary restriction while activity normalizes."
    retryAfterMs = 5 * 60_000
  } else if (score >= 25) {
    decision = "CHALLENGE"
    reason = "Extra confirmation required."
  } else if (score >= 15) {
    decision = "THROTTLE"
    reason = "Slow down — too many requests."
    retryAfterMs = 3_000
  } else if (score >= 8) {
    decision = "WARN"
    reason = "Unusual activity detected."
  }

  const entry = { at: Date.now(), key, decision, reason }
  const log = audit()
  log.push(entry)
  if (log.length > 500) log.splice(0, log.length - 500)

  return { decision, score, signals, reason, retryAfterMs }
}

export function isActionAllowed(ev: RiskEvaluation): boolean {
  return (
    ev.decision === "ALLOW" ||
    ev.decision === "WARN" ||
    ev.decision === "THROTTLE" ||
    ev.decision === "CHALLENGE"
  )
}

/** Redacted audit tail for moderators */
export function getRecentRiskAudit(limit = 50) {
  return audit().slice(-limit)
}
