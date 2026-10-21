import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const src = (file) => readFileSync(join(root, file), "utf8")
const checks = []
const check = (label, condition) => checks.push({ label, pass: Boolean(condition) })

const phase10 = src("docs/PHASE_10_TESTNET_BETA_LAUNCH_APPROVAL.md")
const nextRoadmap = src("docs/NEXT_ROADMAP_AFTER_PHASE10.md")
const policy = src("lib/server/release/stage7-readiness.ts")
const protocol = src("docs/ops/PHASE7_LIVE_TESTNET_OPERATOR_PROTOCOL.md")
const gates = src("docs/TESTNET_LIVE_RELEASE_GATES.md")
const pkg = JSON.parse(src("package.json"))
const evidenceValidator = src("scripts/validate-release-evidence.mjs")
const evidenceLib = src("scripts/lib/release-evidence.mjs")
const evidenceDocs = src("docs/evidence/README.md")
const evidenceTemplate = JSON.parse(src("docs/evidence/testnet-beta-evidence.template.json"))

check("Phase 10 default decision is not approved", /Current decision:.*NOT APPROVED/i.test(phase10) && /Decision:\s*NOT APPROVED/i.test(phase10))
check("all required beta gates default to blocked", (phase10.match(/\| BLOCKED \|/g) || []).length >= 10)
check("release policy remains fail-closed with financial features disabled", policy.includes('status: "not_release_approved"') && policy.includes('financialFeaturesEnabled: false'))
check("operator protocol is explicitly Testnet Preview only", /Preview/.test(protocol) && /Pi Sandbox\/Testnet/.test(protocol) && /\*\*Do not\*\* use Production\/Mainnet/.test(protocol))
check("live release gates require migration reconciliation and prohibit blind migration application", gates.includes("Reconcile migrations before applying anything") && gates.includes("Do not apply all files"))
check("Phase 10 prohibits production E2E enablement during Testnet work", phase10.includes("GHC_E2E_ALLOW_PRODUCTION=1"))
check("Phase 10 separates Mainnet approval from Testnet approval", phase10.includes("separate review") && phase10.includes("No Mainnet credentials"))
check("Phase 10 includes restore, rollback and kill-switch evidence", phase10.includes("restore rehearsal") && phase10.includes("kill-switch"))
check("next roadmap prioritizes release blockers before expansion", nextRoadmap.indexOf("Track A — Close the release blockers first") < nextRoadmap.indexOf("Track B — Product quality and trust"))
check("next roadmap includes multi-account E2E and financial reconciliation", nextRoadmap.includes("Live multi-account E2E") && nextRoadmap.includes("Financial reconciliation"))
check("Phase 10 test is exposed in npm scripts", pkg.scripts?.["test:phase10-testnet-beta-gates"] === "node scripts/test-phase10-testnet-beta-gates.mjs")
check("Phase 10 test is wired into ci:verify", pkg.scripts?.["ci:verify"]?.includes("npm run test:phase10-testnet-beta-gates"))
check("release evidence validator accepts only the Testnet Preview target", evidenceLib.includes('manifest.releaseTarget !== "testnet-preview"'))
check("release evidence validator requires every gate, hashed artifacts, and four distinct approvers", evidenceLib.includes("REQUIRED_BETA_GATES") && evidenceLib.includes("checksum does not match artifact") && evidenceLib.includes("must be distinct people"))
check("evidence template cannot imply approval by default", evidenceTemplate.approval.decision === "not_approved" && evidenceTemplate.gates.every((gate) => gate.status === "blocked"))
check("evidence packet workflow documents artifact hashes and independent review", evidenceDocs.includes("SHA-256") && /reviewers must independently inspect artifacts/i.test(evidenceDocs))
check("template creation refuses to overwrite existing evidence", evidenceValidator.includes('{ flag: "wx" }') && evidenceValidator.includes("Refusing to overwrite"))
check("release evidence validator regression suite is part of CI", pkg.scripts?.["ci:verify"]?.includes("npm run test:release-evidence-validator"))

for (const { label, pass } of checks) console.log(`${pass ? "PASS" : "FAIL"} ${label}`)
const failures = checks.filter((item) => !item.pass)
console.log(`\nPhase 10 Testnet beta gates: ${checks.length - failures.length}/${checks.length} passed`)
if (failures.length) process.exit(1)
