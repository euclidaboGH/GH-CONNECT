/**
 * Global Beta Readiness contract.
 * Server-owned, fail-closed and evidence-oriented. It never claims a live
 * provider/database check passed merely because configuration exists.
 */
import { evaluateReadiness, type ReadinessReport } from "@/lib/server/readiness"
import { getStage7ReadinessPolicy } from "@/lib/server/release/stage7-readiness"

export type BetaGateStatus = "pass" | "blocked" | "operator_required"

export type BetaGate = {
  id: string
  title: string
  status: BetaGateStatus
  evidence: string[]
  remediation: string
}

export type BetaReadinessReport = {
  version: "1"
  service: "gh-connect"
  status: "blocked" | "conditional" | "ready_for_operator_review"
  generatedAt: string
  deploymentPerformed: false
  financialFeaturesEnabled: false
  environment: ReadinessReport["environment"]
  gates: BetaGate[]
  blockers: string[]
  warnings: string[]
  requiredEvidence: string[]
  recovery: {
    backupRestoreRehearsal: "required"
    rollbackRehearsal: "required"
    featureKillSwitchVerification: "required"
    incidentOwner: "required"
  }
}

function env(name: string): boolean {
  return Boolean((process.env[name] || "").trim())
}

export function evaluateBetaReadiness(opts?: { hostname?: string | null }): BetaReadinessReport {
  const foundation = evaluateReadiness(opts)
  const policy = getStage7ReadinessPolicy()
  const gates: BetaGate[] = []

  const evidence = (name: string, ok: boolean, detail: string, remediation: string): BetaGate => ({
    id: name,
    title: detail,
    status: ok ? "pass" : "blocked",
    evidence: [name],
    remediation,
  })

  gates.push(evidence(
    "foundation-readiness",
    foundation.status !== "not_ready",
    "Foundation health/readiness contract",
    "Resolve critical /api/health blockers before beta traffic."
  ))
  gates.push(evidence(
    "node24-production",
    false,
    "Node 24 production execution evidence",
    "Run npm ci --legacy-peer-deps, npm run typecheck, npm run lint and npm run build on the Node 24 Vercel environment."
  ))
  gates.push(evidence(
    "testnet-multi-user",
    env("GHC_TESTNET_E2E_EVIDENCE") || env("GHC_BETA_EVIDENCE_BUNDLE"),
    "Pi Testnet multi-user evidence",
    "Execute Phase 42 against the real Testnet Preview deployment with two independent Pi identities and retain the evidence bundle."
  ))
  gates.push(evidence(
    "observability",
    env("GHC_OBSERVABILITY_CONFIRMED"),
    "Production observability and alerting",
    "Confirm redacted structured logs, health/readiness probes, payment/reconciliation alerts and retention policy."
  ))
  gates.push(evidence(
    "backup-restore",
    env("GHC_BACKUP_RESTORE_REHEARSAL"),
    "Database backup/restore rehearsal",
    "Restore a current backup into an isolated environment and verify identity, economy, payment and marketplace invariants."
  ))
  gates.push(evidence(
    "rollback",
    env("GHC_ROLLBACK_REHEARSAL"),
    "Application/database rollback rehearsal",
    "Exercise the documented forward/rollback migration and deployment procedure without exposing production financial state."
  ))
  gates.push(evidence(
    "kill-switches",
    env("GHC_KILLSWITCH_REHEARSAL"),
    "Financial and provider feature kill switches",
    "Verify Pi payment, GHC issuance/redemption, withdrawals and marketplace payment controls can be disabled safely."
  ))
  gates.push(evidence(
    "incident-owner",
    env("GHC_INCIDENT_OWNER_CONFIRMED"),
    "Named incident owner and support procedure",
    "Record accountable release/incident ownership and the escalation/runbook path."
  ))

  // Policy remains authoritative: beta readiness cannot silently override it.
  const blockers = [
    ...foundation.blockers,
    ...gates.filter((g) => g.status === "blocked").map((g) => g.title),
  ]
  const warnings = [...foundation.warnings]
  const status = blockers.length === 0 ? "ready_for_operator_review" : "blocked"

  return {
    version: "1",
    service: "gh-connect",
    status,
    generatedAt: new Date().toISOString(),
    deploymentPerformed: false,
    financialFeaturesEnabled: false,
    environment: foundation.environment,
    gates,
    blockers,
    warnings,
    requiredEvidence: policy.gates.flatMap((g) => [...g.evidence]),
    recovery: {
      backupRestoreRehearsal: "required",
      rollbackRehearsal: "required",
      featureKillSwitchVerification: "required",
      incidentOwner: "required",
    },
  }
}
