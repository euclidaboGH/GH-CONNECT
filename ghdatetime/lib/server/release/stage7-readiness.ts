/**
 * Stage 7 release-readiness policy for GreenHaven.
 * This is a server-owned, read-only checklist. It does not claim live checks
 * passed and cannot enable financial features or deploy the application.
 */
export type ReleaseGateStatus = "required" | "blocked_until_evidence" | "operator_approval_required"

const GATES = [
  { id: "ci", title: "Build and code quality", status: "blocked_until_evidence" as const, evidence: ["npm ci --legacy-peer-deps", "npm run typecheck", "npm run lint", "npm run build", "npm run ci:verify"] },
  { id: "payments", title: "Payment and ledger reconciliation", status: "blocked_until_evidence" as const, evidence: ["Provider-verified settlement records", "Idempotent ledger references", "Duplicate and concurrent callback tests", "Refund and reversal reconciliation"] },
  { id: "security", title: "Identity and authorization", status: "blocked_until_evidence" as const, evidence: ["Cross-account authorization tests", "RLS and grants review", "Rate-limit and abuse tests", "Secret and dependency scan"] },
  { id: "observability", title: "Production observability", status: "required" as const, evidence: ["Structured redacted logs", "Health/readiness checks", "Payment failure and reconciliation alerts", "Retention and incident runbook"] },
  { id: "recovery", title: "Recovery and rollback", status: "operator_approval_required" as const, evidence: ["Database backup and restore rehearsal", "Migration rollback/forward plan", "Feature-flag kill switch verification", "Named release owner and incident contact"] },
  { id: "rollout", title: "Staged rollout", status: "operator_approval_required" as const, evidence: ["Testnet multi-user evidence", "Canary cohort and success thresholds", "Rollback triggers and monitoring window", "Written product, finance, policy and legal approval"] },
] as const

export function getStage7ReadinessPolicy() {
  return {
    version: "1",
    stage: 7,
    status: "not_release_approved" as const,
    generatedAt: null,
    deploymentPerformed: false as const,
    financialFeaturesEnabled: false as const,
    gates: GATES.map((gate) => ({ ...gate, evidence: [...gate.evidence] })),
    rules: [
      "A checklist is not evidence that a check has passed.",
      "Never expose secrets, raw payment payloads, personal data, or wallet identifiers in logs.",
      "Do not activate Pi-funded GHC acquisition or business checkout without independent approval and verified end-to-end evidence.",
      "Release only after all mandatory gates have evidence, an accountable operator approves, and rollback is tested.",
    ],
  }
}
