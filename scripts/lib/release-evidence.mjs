import { existsSync, readFileSync, realpathSync, statSync } from "node:fs"
import { createHash } from "node:crypto"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"

export const REQUIRED_BETA_GATES = [
  { id: "runtime-build", title: "Runtime and reproducible build" },
  { id: "environment-isolation", title: "Preview/Testnet environment isolation" },
  { id: "schema-migrations", title: "Migration inventory and replay" },
  { id: "authentication", title: "Two-account Testnet authentication" },
  { id: "authorization-privacy", title: "Cross-account authorization and privacy" },
  { id: "financial-integrity", title: "Payment and ledger reconciliation" },
  { id: "social-realtime", title: "Cross-account social and realtime behavior" },
  { id: "media", title: "Private media lifecycle and access control" },
  { id: "recovery", title: "Restore, rollback and kill-switch rehearsal" },
  { id: "observability", title: "Monitoring, alerts and incident ownership" },
  { id: "product-acceptance", title: "Device, accessibility and product acceptance" },
]

const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}/i,
  /\b(?:sk_live_|sk_test_|whsec_|sb_secret_)[A-Za-z0-9_-]{12,}/i,
  /(?:^|[^A-Za-z0-9])(?:API[_-]?KEY|CLIENT[_-]?SECRET|SERVICE[_-]?ROLE[_-]?KEY|PASSWORD|ACCESS[_-]?TOKEN|REFRESH[_-]?TOKEN)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{8,}/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  /\b(?:service_role|service-role)\s*[:=]\s*[^\s,;]{8,}/i,
]
const REQUIRED_REVIEWERS = ["engineering", "security", "operations", "financeProduct"]

export function createEvidenceTemplate({ packageVersion = "0.63.25", nodeVersion = "24.15.0" } = {}) {
  return {
    schemaVersion: 1,
    releaseTarget: "testnet-preview",
    packageVersion,
    commitSha: "",
    generatedAt: "",
    runtime: { node: nodeVersion, npm: "" },
    gates: REQUIRED_BETA_GATES.map((gate) => ({
      ...gate,
      status: "blocked",
      evidence: [],
      notes: "",
    })),
    approval: {
      decision: "not_approved",
      decidedAt: "",
      reviewers: { engineering: "", security: "", operations: "", financeProduct: "" },
      unresolvedRisks: [],
    },
  }
}

function isIsoDate(value) {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}T/.test(value)
}

function scanForSecrets(value, path, errors) {
  if (typeof value === "string") {
    if (SECRET_PATTERNS.some((pattern) => pattern.test(value))) errors.push(`${path}: looks like it contains a credential or token; remove it and rotate it if real`)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForSecrets(entry, `${path}[${index}]`, errors))
    return
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (/(?:api.?key|password|secret|(?:access|refresh|id).?token|(?:^|[_-])token(?:$|[_-])|session.?cookie|service.?role.?key|private.?key|authorization.?header|^cookie$)/i.test(key)) {
        errors.push(`${path}.${key}: secret-bearing field names are not allowed in the evidence packet`)
      }
      scanForSecrets(entry, `${path}.${key}`, errors)
    }
  }
}

function validateArtifact(artifact, manifestDir, gateId, index, errors, allowedReviewers, manifestGeneratedAt) {
  const label = `gates.${gateId}.evidence[${index}]`
  if (!artifact || typeof artifact !== "object") {
    errors.push(`${label}: evidence record must be an object`)
    return
  }
  if (typeof artifact.path !== "string" || !artifact.path.trim() || isAbsolute(artifact.path)) {
    errors.push(`${label}.path: use a non-empty relative artifact path`)
    return
  }
  const resolved = resolve(manifestDir, artifact.path)
  const rel = relative(manifestDir, resolved)
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    errors.push(`${label}.path: artifact must remain inside the evidence packet directory`)
    return
  }
  if (!existsSync(resolved)) {
    errors.push(`${label}.path: referenced artifact does not exist`)
    return
  }
  let actualPath
  try { actualPath = realpathSync(resolved) } catch { errors.push(`${label}.path: artifact path could not be resolved safely`); return }
  const actualRelative = relative(realpathSync(manifestDir), actualPath)
  if (actualRelative === ".." || actualRelative.startsWith(`..${sep}`) || isAbsolute(actualRelative)) {
    errors.push(`${label}.path: symlinks may not escape the evidence packet directory`)
    return
  }
  if (!statSync(actualPath).isFile()) {
    errors.push(`${label}.path: evidence artifact must be a regular file`)
    return
  }
  if (typeof artifact.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(artifact.sha256)) {
    errors.push(`${label}.sha256: expected a 64-character SHA-256 hex digest`)
  } else {
    const bytes = readFileSync(actualPath)
    const actual = createHash("sha256").update(bytes).digest("hex")
    if (actual.toLowerCase() !== artifact.sha256.toLowerCase()) errors.push(`${label}.sha256: checksum does not match artifact`)
    const artifactText = bytes.toString("utf8")
    if (SECRET_PATTERNS.some((pattern) => pattern.test(artifactText))) errors.push(`${label}.path: artifact appears to contain a credential or token; sanitize it and rotate any exposed secret`)
  }
  if (!isIsoDate(artifact.observedAt)) errors.push(`${label}.observedAt: expected an ISO-8601 timestamp`)
  else if (isIsoDate(manifestGeneratedAt) && Date.parse(artifact.observedAt) > Date.parse(manifestGeneratedAt)) errors.push(`${label}.observedAt: evidence observation cannot occur after the packet generation time`)
  if (typeof artifact.reviewer !== "string" || artifact.reviewer.trim().length < 2) errors.push(`${label}.reviewer: name the person who reviewed this evidence`)
  else if (allowedReviewers.size > 0 && !allowedReviewers.has(artifact.reviewer.trim().toLowerCase())) errors.push(`${label}.reviewer: reviewer must be one of the named accountable approvers`)
}

export function validateEvidenceManifest(manifest, { manifestPath = process.cwd(), expectedPackageVersion } = {}) {
  const errors = []
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { valid: false, approved: false, errors: ["manifest: expected a JSON object"], passedGates: 0, requiredGates: REQUIRED_BETA_GATES.length }
  }
  scanForSecrets(manifest, "manifest", errors)
  if (manifest.schemaVersion !== 1) errors.push("schemaVersion: expected 1")
  if (manifest.releaseTarget !== "testnet-preview") errors.push("releaseTarget: only testnet-preview is accepted by this beta validator; Mainnet requires a separate review process")
  if (typeof manifest.packageVersion !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.packageVersion)) errors.push("packageVersion: expected a semantic version")
  else if (expectedPackageVersion && manifest.packageVersion !== expectedPackageVersion) errors.push("packageVersion: does not match this source tree package.json")
  if (typeof manifest.commitSha !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(manifest.commitSha)) errors.push("commitSha: expected a full 40- or 64-character commit SHA")
  if (!isIsoDate(manifest.generatedAt)) errors.push("generatedAt: expected an ISO-8601 timestamp")
  if (!manifest.runtime || manifest.runtime.node !== "24.15.0" || typeof manifest.runtime.npm !== "string" || !manifest.runtime.npm.trim()) errors.push("runtime: record Node 24.15.0 and the exact npm version used for verification")

  const approvalReviewers = manifest.approval?.reviewers || {}
  const allowedReviewers = new Set(REQUIRED_REVIEWERS.map((reviewer) => String(approvalReviewers[reviewer] || "").trim().toLowerCase()).filter(Boolean))
  const gateList = Array.isArray(manifest.gates) ? manifest.gates : []
  const byId = new Map()
  for (const gate of gateList) {
    if (!gate || typeof gate.id !== "string") {
      errors.push("gates: each entry needs an id")
      continue
    }
    if (byId.has(gate.id)) errors.push(`gates.${gate.id}: duplicate gate id`)
    else byId.set(gate.id, gate)
  }
  for (const required of REQUIRED_BETA_GATES) {
    const gate = byId.get(required.id)
    if (!gate) {
      errors.push(`gates.${required.id}: required gate is missing`)
      continue
    }
    if (gate.status !== "passed") errors.push(`gates.${required.id}: status must be passed; current status is not acceptable`)
    if (!Array.isArray(gate.evidence) || gate.evidence.length === 0) {
      errors.push(`gates.${required.id}: at least one hashed evidence artifact is required`)
    } else {
      gate.evidence.forEach((artifact, index) => validateArtifact(artifact, dirname(resolve(manifestPath)), required.id, index, errors, allowedReviewers, manifest.generatedAt))
    }
  }
  for (const gate of gateList) {
    if (gate && typeof gate.id === "string" && !REQUIRED_BETA_GATES.some((required) => required.id === gate.id)) errors.push(`gates.${gate.id}: unknown gate id; update the validator and review policy before adding gates`)
  }

  const approval = manifest.approval
  if (!approval || typeof approval !== "object") {
    errors.push("approval: explicit reviewer approval is required")
  } else {
    if (approval.decision !== "approved") errors.push("approval.decision: must be approved after all evidence has been reviewed")
    if (!isIsoDate(approval.decidedAt)) errors.push("approval.decidedAt: expected an ISO-8601 timestamp")
    else if (isIsoDate(manifest.generatedAt) && Date.parse(approval.decidedAt) < Date.parse(manifest.generatedAt)) errors.push("approval.decidedAt: approval must occur at or after evidence packet generation")
    for (const reviewer of REQUIRED_REVIEWERS) {
      if (typeof approval.reviewers?.[reviewer] !== "string" || approval.reviewers[reviewer].trim().length < 2) errors.push(`approval.reviewers.${reviewer}: accountable named reviewer is required`)
    }
    const reviewerNames = REQUIRED_REVIEWERS.map((reviewer) => String(approval.reviewers?.[reviewer] || "").trim().toLowerCase()).filter(Boolean)
    if (new Set(reviewerNames).size !== reviewerNames.length) errors.push("approval.reviewers: engineering, security, operations, and finance/product reviewers must be distinct people")
    if (!Array.isArray(approval.unresolvedRisks)) errors.push("approval.unresolvedRisks: expected an array; unresolved risks must be explicit")
    else if (approval.unresolvedRisks.some((risk) => typeof risk !== "string" || !risk.trim())) errors.push("approval.unresolvedRisks: each risk must be a non-empty string")
    else if (approval.unresolvedRisks.length > 0) errors.push("approval.unresolvedRisks: unresolved risks must be closed or explicitly reclassified before beta approval")
  }

  const passedGates = REQUIRED_BETA_GATES.filter((required) => byId.get(required.id)?.status === "passed").length
  return { valid: errors.length === 0, approved: errors.length === 0, errors, passedGates, requiredGates: REQUIRED_BETA_GATES.length }
}
