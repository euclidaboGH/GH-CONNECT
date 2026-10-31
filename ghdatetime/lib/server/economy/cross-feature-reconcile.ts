/**
 * Phase 11 — Cross-feature wallet reconciliation (read-only).
 * Composes GHC policy surface, PI earnings withdrawable, cashback feature flag,
 * and asset-separation invariants. Never invents balances or writes ledgers.
 */
import { getWithdrawableBalance, getEarningsBalances } from "@/lib/server/earnings/unified-ledger"
import { getCharityUserSummary } from "@/lib/server/earnings/platform-utility"
import { readGhcServerEnv, hasPrivilegedDatabase } from "@/lib/server/economy/env"
import { ASSET_POLICY } from "@/lib/asset-separation"

export type CrossFeatureFinding = {
  code: string
  severity: "info" | "attention" | "ok"
  message: string
}

export type CrossFeatureReport = {
  ok: boolean
  userId: string
  generatedAt: string
  assets: {
    ghc: { rail: string; note: string }
    pi: { rail: string; note: string }
  }
  piEarnings: {
    available: boolean
    availableAtomic?: number | string
    reservedAtomic?: number | string
    pendingAtomic?: number | string
    withdrawableAtomic?: number | string
    eligible?: boolean
    reasons?: string[]
    error?: string
  }
  charity: {
    available: boolean
    totalAtomic?: number | string
    contributionCount?: number
    withdrawable: false
    error?: string
  }
  cashback: {
    probed: boolean
    featureAvailable?: boolean
    calculatedAtomic?: string
    reservedAtomic?: string
    needsReviewAtomic?: string
    error?: string
  }
  ledgerBalances: {
    available: boolean
    availableAtomic?: number | string
    reservedAtomic?: number | string
    pendingAtomic?: number | string
    paidAtomic?: number | string
    error?: string
  }
  status: "healthy" | "attention" | "degraded"
  invariants: {
    ghcAndPiSeparated: boolean
    charityNotWithdrawable: boolean
    piEarningsAuthority: string
  }
  findings: CrossFeatureFinding[]
  relatedEndpoints: string[]
}

function validAtomic(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value)
  if (typeof value === "string" && /^\d{1,38}$/.test(value)) return value
  return undefined
}

async function probeCashback(userId: string): Promise<{
  probed: boolean
  featureAvailable?: boolean
  calculatedAtomic?: string
  reservedAtomic?: string
  needsReviewAtomic?: string
  error?: string
}> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey || !hasPrivilegedDatabase()) {
    return { probed: false, featureAvailable: false, error: "CASHBACK_DATABASE_UNAVAILABLE" }
  }
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_pi_cashback_user_statement`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({ p_user_id: userId, p_limit: 1 }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    })
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !payload || payload.ok !== true || payload.featureAvailable !== true) {
      return { probed: true, featureAvailable: false, error: "CASHBACK_STATEMENT_UNAVAILABLE" }
    }
    const calculatedAtomic = validAtomic(payload.calculatedAtomic)
    const needsReviewAtomic = validAtomic(payload.needsReviewAtomic)
    if (calculatedAtomic === undefined || needsReviewAtomic === undefined) {
      return { probed: true, featureAvailable: false, error: "CASHBACK_STATEMENT_INVALID" }
    }
    return { probed: true, featureAvailable: true, calculatedAtomic, needsReviewAtomic }
  } catch {
    return { probed: true, featureAvailable: false, error: "CASHBACK_STATEMENT_UNAVAILABLE" }
  }
}

export async function buildCrossFeatureReconcileReport(input: {
  userId: string
  requestHeaders?: Headers
}): Promise<CrossFeatureReport> {
  const findings: CrossFeatureFinding[] = []
  const userId = String(input.userId || "").trim()

  const [pi, ledger, charity, cashback] = await Promise.all([
    getWithdrawableBalance(userId),
    getEarningsBalances(userId),
    getCharityUserSummary(userId),
    probeCashback(userId),
  ])

  if (!hasPrivilegedDatabase()) {
    findings.push({
      code: "DATABASE_NOT_CONFIGURED",
      severity: "attention",
      message: "Privileged database is not configured in this environment; PI earnings probes may be unavailable.",
    })
  }

  if (!pi.ok) {
    findings.push({
      code: "PI_EARNINGS_UNAVAILABLE",
      severity: pi.error === "EARNINGS_LEDGER_UNAVAILABLE" ? "attention" : "attention",
      message: `PI earnings snapshot unavailable: ${pi.error || "unknown"}`,
    })
  } else if (pi.eligible === false && Array.isArray(pi.reasons) && pi.reasons.length > 0) {
    findings.push({
      code: "PI_WITHDRAW_NOT_ELIGIBLE",
      severity: "info",
      message: `PI withdrawal not eligible: ${pi.reasons.join(", ")}`,
    })
  } else if (pi.ok && pi.eligible) {
    findings.push({
      code: "PI_WITHDRAW_ELIGIBLE",
      severity: "ok",
      message: "PI earnings report eligible withdrawable balance under current policy.",
    })
  }

  const ledgerAvailable = ledger.ok === true
  if (!ledgerAvailable) {
    findings.push({ code: "PI_LEDGER_BALANCES_UNAVAILABLE", severity: "attention", message: `PI ledger balance snapshot unavailable: ${ledger.error || "unknown"}` })
  } else if (pi.ok) {
    const ledgerAvailableAtomic = validAtomic(ledger.availableAtomic)
    const snapshotAvailableAtomic = validAtomic(pi.availableAtomic)
    const ledgerReservedAtomic = validAtomic(ledger.reservedAtomic)
    const snapshotReservedAtomic = validAtomic(pi.reservedAtomic)
    if (ledgerAvailableAtomic === undefined || snapshotAvailableAtomic === undefined || ledgerReservedAtomic === undefined || snapshotReservedAtomic === undefined) {
      findings.push({ code: "PI_BALANCE_SNAPSHOT_INVALID", severity: "attention", message: "PI balance snapshots contain invalid atomic-unit values; no balance equality is asserted." })
    } else if (ledgerAvailableAtomic !== snapshotAvailableAtomic || ledgerReservedAtomic !== snapshotReservedAtomic) {
      findings.push({ code: "PI_BALANCE_SNAPSHOT_MISMATCH", severity: "attention", message: "PI earnings and withdrawable snapshots disagree. Withdrawals should be reviewed until the authoritative ledger views reconcile." })
    } else {
      findings.push({ code: "PI_BALANCE_SNAPSHOTS_MATCH", severity: "ok", message: "PI earnings and withdrawable snapshots agree for available and reserved atomic units." })
    }
  }

  if (!cashback.featureAvailable) {
    findings.push({ code: "CASHBACK_SNAPSHOT_UNAVAILABLE", severity: "attention", message: `Cashback statement unavailable: ${cashback.error || "unknown"}` })
  } else {
    findings.push({ code: "CASHBACK_SNAPSHOT_VERIFIED", severity: "ok", message: "Cashback statement was read from its authoritative server-side ledger." })
  }

  const charityOk = charity?.ok === true
  if (!charityOk) {
    findings.push({
      code: "CHARITY_SUMMARY_UNAVAILABLE",
      severity: "info",
      message: `Charity summary unavailable: ${charity?.error || "unknown"}`,
    })
  } else {
    findings.push({
      code: "CHARITY_SEGREGATED",
      severity: "ok",
      message: "Charity contributions are segregated from withdrawable PI earnings.",
    })
  }

  // Asset separation from shared policy
  const ghcLabel = (ASSET_POLICY as { ghc?: { label?: string } })?.ghc?.label || "GHC"
  const piLabel = (ASSET_POLICY as { pi?: { label?: string } })?.pi?.label || "PI"
  findings.push({
    code: "ASSET_SEPARATION",
    severity: "ok",
    message: `${ghcLabel} and ${piLabel} remain separate rails; do not convert or merge client-side.`,
  })


  return {
    ok: true,
    userId,
    generatedAt: new Date().toISOString(),
    assets: {
      ghc: {
        rail: "GHC",
        note: "Daily claim / utility ledger — separate from PI earnings A2U",
      },
      pi: {
        rail: "PI",
        note: "Earnings ledger + cashback entitlements + linked Pi wallet A2U",
      },
    },
    piEarnings: {
      available: pi.ok === true,
      availableAtomic: pi.availableAtomic,
      reservedAtomic: pi.reservedAtomic,
      pendingAtomic: pi.pendingAtomic,
      withdrawableAtomic: pi.withdrawableAtomic,
      eligible: pi.eligible,
      reasons: pi.reasons,
      error: pi.ok ? undefined : pi.error,
    },
    charity: {
      available: charityOk,
      totalAtomic: charityOk ? charity?.totalAtomic : undefined,
      contributionCount: charityOk ? charity?.contributionCount : undefined,
      withdrawable: false,
      error: charityOk ? undefined : charity?.error,
    },
    cashback: {
      probed: cashback.probed,
      featureAvailable: cashback.featureAvailable,
      calculatedAtomic: cashback.calculatedAtomic,
      needsReviewAtomic: cashback.needsReviewAtomic,
      error: cashback.error,
    },
    ledgerBalances: {
      available: ledgerAvailable,
      availableAtomic: ledger.availableAtomic,
      reservedAtomic: ledger.reservedAtomic,
      pendingAtomic: ledger.pendingAtomic,
      paidAtomic: ledger.paidAtomic,
      error: ledgerAvailable ? undefined : ledger.error,
    },
    status: findings.some((f) => f.severity === "attention") ? (pi.ok && ledgerAvailable && charityOk ? "attention" : "degraded") : "healthy",
    invariants: {
      ghcAndPiSeparated: true,
      charityNotWithdrawable: true,
      piEarningsAuthority: "gh_earnings_ledger_entries",
    },
    findings,
    relatedEndpoints: [
      "/api/economy/earnings/withdrawable",
      "/api/economy/earnings",
      "/api/economy/earnings/charity",
      "/api/economy/rewards/pi-cashback",
      "/api/payments/reconciliation",
      "/api/economy/wallet",
    ],
  }
}
