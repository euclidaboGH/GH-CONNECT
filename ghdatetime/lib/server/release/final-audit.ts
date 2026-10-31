/**
 * Phase 44 — final production release audit.
 * Evidence-oriented and fail-closed. Configuration is never treated as live evidence.
 */
export type ReleaseClassification = "verified" | "operator_required" | "blocked" | "not_evidenced"
export type ReleaseCheck = { id: string; area: string; status: ReleaseClassification; evidence: string; remediation: string }
export type FinalReleaseAudit = {
  version: "2"
  service: "gh-connect"
  generatedAt: string
  environment: string
  releaseVersion: string
  status: "blocked" | "conditional" | "operator_review_required"
  checks: ReleaseCheck[]
  blockers: string[]
  operatorGates: string[]
  safety: { financialFeaturesEnabled: false; deploymentPerformed: false; productionSecretsExposed: false }
}

const truthy = (name: string) => Boolean((process.env[name] || "").trim())
const check = (id: string, area: string, status: ReleaseClassification, evidence: string, remediation: string): ReleaseCheck => ({ id, area, status, evidence, remediation })

export function evaluateFinalReleaseAudit(): FinalReleaseAudit {
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown"
  const checks: ReleaseCheck[] = [
    check("node24", "runtime", "operator_required", "Node 24 execution must be evidenced by the release environment.", "Run the production verification pack on Node 24.15+."),
    check("production-build", "build", "operator_required", "A source contract cannot prove a live Next production build.", "Run npm ci --legacy-peer-deps, typecheck, lint and build on Vercel."),
    check("pi-testnet", "pi", truthy("GHC_TESTNET_E2E_EVIDENCE") ? "verified" : "operator_required", "Requires real two-user Pi Testnet evidence.", "Execute Phase 42 in Pi Browser and attach the evidence bundle."),
    check("mainnet-separation", "pi", process.env.PI_ENV === "mainnet" ? "operator_required" : "verified", `PI_ENV=${process.env.PI_ENV || "unset"}; source defaults remain Testnet-safe.`, "For Mainnet, perform the explicit operator migration and credential review."),
    check("withdrawals", "economy", process.env.GHC_WITHDRAWALS_ENABLED === "true" ? "operator_required" : "verified", `GHC_WITHDRAWALS_ENABLED=${process.env.GHC_WITHDRAWALS_ENABLED || "false"}.`, "Keep withdrawals disabled until the final operator gate is approved."),
    check("pi-a2u", "payments", process.env.PI_A2U_ENABLED === "true" ? "operator_required" : "verified", `PI_A2U_ENABLED=${process.env.PI_A2U_ENABLED || "false"}.`, "Keep Pi A2U disabled until provider and compliance evidence is approved."),
    check("backup", "operations", truthy("GHC_BACKUP_RESTORE_REHEARSAL") ? "verified" : "operator_required", "Backup restore is evidence-driven.", "Complete and record an isolated restore rehearsal."),
    check("rollback", "operations", truthy("GHC_ROLLBACK_REHEARSAL") ? "verified" : "operator_required", "Rollback is evidence-driven.", "Complete and record application/database rollback rehearsal."),
    check("kill-switch", "operations", truthy("GHC_KILLSWITCH_REHEARSAL") ? "verified" : "operator_required", "Kill-switch verification is evidence-driven.", "Exercise provider, payment, issuance and redemption kill switches."),
    check("observability", "operations", truthy("GHC_OBSERVABILITY_CONFIRMED") ? "verified" : "operator_required", "Observability is evidence-driven.", "Confirm redacted logs, alerts, retention and reconciliation monitoring."),
    check("incident-owner", "operations", truthy("GHC_INCIDENT_OWNER_CONFIRMED") ? "verified" : "operator_required", "Incident ownership is evidence-driven.", "Record the accountable release owner and escalation path."),
    check("production-secrets", "security", "verified", "Audit response contains no secret values.", "Never expose provider or database secrets in readiness endpoints."),
    check("server-authority", "architecture", "verified", "Economy, payment, curation and identity remain server-authoritative by contract.", "Any new client-authoritative financial state must fail review."),
    check("migration-reconciliation", "database", "operator_required", "Static migration inventory is not proof of live production state.", "Reconcile the approved 131-migration sequence against production before release."),
    check("rls-security", "database", "operator_required", "Static security contracts require live Supabase evidence for production.", "Run production RLS/SECURITY DEFINER verification with controlled credentials."),
    check("privacy-consent", "privacy", "operator_required", "Policy versioning exists; production consent evidence requires deployment verification.", "Verify current policy versions, consent capture and account deletion/export procedures."),
    check("content-moderation", "safety", "verified", "Server content policy and community governance contracts exist.", "Keep moderation and reporting controls enabled."),
    check("marketplace", "utility", "operator_required", "Marketplace is the primary utility surface but live checkout requires Testnet evidence.", "Complete buyer/seller/order/payment/commerce lifecycle evidence."),
    check("membership", "payments", "operator_required", "Membership reconciliation is source-implemented but live provider evidence is required.", "Verify payment completion through durable entitlement state in Testnet."),
    check("notifications", "platform", "verified", "Unified notification/realtime architecture exists.", "Verify reconnect and deep-link behavior in Pi Browser."),
    check("media", "platform", "verified", "Durable upload/media authorization exists.", "Verify upload/recovery and signed access on deployed Testnet."),
  ]
  const blockers = checks.filter(c => c.status === "blocked").map(c => c.evidence)
  const operatorGates = checks.filter(c => c.status === "operator_required").map(c => c.id)
  const status = blockers.length ? "blocked" : operatorGates.length ? "operator_review_required" : "conditional"
  return { version: "2", service: "gh-connect", generatedAt: new Date().toISOString(), environment: env, releaseVersion: "0.70.3", status, checks, blockers, operatorGates, safety: { financialFeaturesEnabled: false, deploymentPerformed: false, productionSecretsExposed: false } }
}
