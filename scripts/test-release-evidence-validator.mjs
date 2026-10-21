import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { createEvidenceTemplate, REQUIRED_BETA_GATES, validateEvidenceManifest } from "./lib/release-evidence.mjs"

const temp = mkdtempSync(join(tmpdir(), "ghc-release-evidence-"))
const validatorScript = join(process.cwd(), "scripts", "validate-release-evidence.mjs")
let passed = 0
function test(name, fn) { try { fn(); passed++; console.log(`PASS ${name}`) } catch (error) { console.error(`FAIL ${name}: ${error.message}`); process.exitCode = 1 } }
function makeValidPacket() {
  const manifestDir = join(temp, "packet")
  mkdirSync(join(manifestDir, "artifacts"), { recursive: true })
  const manifest = createEvidenceTemplate()
  manifest.commitSha = "a".repeat(40)
  manifest.generatedAt = "2026-10-21T12:00:00.000Z"
  manifest.runtime.npm = "11.6.2"
  for (const gate of manifest.gates) {
    const path = `artifacts/${gate.id}.txt`
    const content = `Reviewed evidence for ${gate.id}\n`
    writeFileSync(join(manifestDir, path), content)
    gate.status = "passed"
    gate.evidence = [{ path, sha256: createHash("sha256").update(content).digest("hex"), observedAt: "2026-10-21T12:00:00.000Z", reviewer: ["Engineer One", "Security One", "Operations One", "Finance One"][manifest.gates.indexOf(gate) % 4] }]
  }
  manifest.approval = { decision: "approved", decidedAt: "2026-10-21T13:00:00.000Z", reviewers: { engineering: "Engineer One", security: "Security One", operations: "Operations One", financeProduct: "Finance One" }, unresolvedRisks: [] }
  return { manifest, manifestPath: join(manifestDir, "manifest.json") }
}

test("template is blocked by default and targets Testnet Preview", () => {
  const template = createEvidenceTemplate()
  assert.equal(template.releaseTarget, "testnet-preview")
  assert.equal(template.approval.decision, "not_approved")
  assert.ok(template.gates.every((gate) => gate.status === "blocked"))
})
test("rejects an incomplete evidence packet", () => {
  const packet = makeValidPacket()
  packet.manifest.gates[0].status = "blocked"
  const result = validateEvidenceManifest(packet.manifest, { manifestPath: packet.manifestPath })
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes("runtime-build")))
})
test("accepts a fully evidenced and reviewed Testnet packet", () => {
  const packet = makeValidPacket()
  const result = validateEvidenceManifest(packet.manifest, { manifestPath: packet.manifestPath })
  assert.equal(result.valid, true, result.errors.join("; "))
  assert.equal(result.passedGates, REQUIRED_BETA_GATES.length)
})
test("rejects a package version that does not match the checked source tree", () => {
  const packet = makeValidPacket()
  const result = validateEvidenceManifest(packet.manifest, { manifestPath: packet.manifestPath, expectedPackageVersion: "0.63.26" })
  assert.ok(result.errors.some((error) => error.includes("does not match this source tree package.json")))
})
test("rejects Mainnet target from the Testnet validator", () => {
  const packet = makeValidPacket()
  packet.manifest.releaseTarget = "mainnet-production"
  const result = validateEvidenceManifest(packet.manifest, { manifestPath: packet.manifestPath })
  assert.ok(result.errors.some((error) => error.includes("only testnet-preview")))
})
test("rejects evidence artifact checksum drift", () => {
  const packet = makeValidPacket()
  packet.manifest.gates[0].evidence[0].sha256 = "0".repeat(64)
  const result = validateEvidenceManifest(packet.manifest, { manifestPath: packet.manifestPath })
  assert.ok(result.errors.some((error) => error.includes("checksum does not match")))
})
test("rejects traversal outside the evidence directory", () => {
  const packet = makeValidPacket()
  packet.manifest.gates[0].evidence[0].path = "../../outside.txt"
  const result = validateEvidenceManifest(packet.manifest, { manifestPath: packet.manifestPath })
  assert.ok(result.errors.some((error) => error.includes("must remain inside")))
})
test("rejects secret-like values in evidence packet", () => {
  const packet = makeValidPacket()
  packet.manifest.gates[0].notes = "Bearer abcdefghijklmnopqrstuvwxyz0123456789"
  const result = validateEvidenceManifest(packet.manifest, { manifestPath: packet.manifestPath })
  assert.ok(result.errors.some((error) => error.includes("credential or token")))
})
test("requires full commit SHA and named approvers", () => {
  const packet = makeValidPacket()
  packet.manifest.commitSha = "abc1234"
  packet.manifest.approval.reviewers.security = ""
  const result = validateEvidenceManifest(packet.manifest, { manifestPath: packet.manifestPath })
  assert.ok(result.errors.some((error) => error.includes("full 40- or 64-character")))
  assert.ok(result.errors.some((error) => error.includes("reviewers.security")))
})
test("rejects symlinked artifacts that escape the evidence directory", () => {
  const packet = makeValidPacket()
  const outside = join(temp, "outside-secret.txt")
  writeFileSync(outside, "safe placeholder\n")
  const link = join(temp, "packet", "artifacts", "escape.txt")
  symlinkSync(outside, link)
  packet.manifest.gates[0].evidence[0].path = "artifacts/escape.txt"
  packet.manifest.gates[0].evidence[0].sha256 = createHash("sha256").update("safe placeholder\n").digest("hex")
  const result = validateEvidenceManifest(packet.manifest, { manifestPath: packet.manifestPath })
  assert.ok(result.errors.some((error) => error.includes("symlinks may not escape")))
})
test("scans evidence artifact content for credential-like values", () => {
  const packet = makeValidPacket()
  const artifactPath = join(dirname(packet.manifestPath), packet.manifest.gates[0].evidence[0].path)
  const content = "Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789\n"
  writeFileSync(artifactPath, content)
  packet.manifest.gates[0].evidence[0].sha256 = createHash("sha256").update(content).digest("hex")
  const result = validateEvidenceManifest(packet.manifest, { manifestPath: packet.manifestPath })
  assert.ok(result.errors.some((error) => error.includes("artifact appears to contain")))
})
test("detects API-key assignments inside evidence artifacts", () => {
  const packet = makeValidPacket()
  const artifactPath = join(dirname(packet.manifestPath), packet.manifest.gates[0].evidence[0].path)
  const content = "PI_API_KEY=example_super_secret_value_123456789\n"
  writeFileSync(artifactPath, content)
  packet.manifest.gates[0].evidence[0].sha256 = createHash("sha256").update(content).digest("hex")
  const result = validateEvidenceManifest(packet.manifest, { manifestPath: packet.manifestPath })
  assert.ok(result.errors.some((error) => error.includes("artifact appears to contain")))
})
test("rejects secret-bearing field names", () => {
  const packet = makeValidPacket()
  packet.manifest.credentials = { apiKey: "redacted" }
  const result = validateEvidenceManifest(packet.manifest, { manifestPath: packet.manifestPath })
  assert.ok(result.errors.some((error) => error.includes("secret-bearing field names")))
})
test("rejects evidence artifacts that have disappeared", () => {
  const packet = makeValidPacket()
  packet.manifest.gates[0].evidence[0].path = "artifacts/missing.txt"
  const result = validateEvidenceManifest(packet.manifest, { manifestPath: packet.manifestPath })
  assert.ok(result.errors.some((error) => error.includes("does not exist")))
})
test("rejects evidence timestamps later than packet generation", () => {
  const packet = makeValidPacket()
  packet.manifest.gates[0].evidence[0].observedAt = "2026-10-22T12:00:00.000Z"
  const result = validateEvidenceManifest(packet.manifest, { manifestPath: packet.manifestPath })
  assert.ok(result.errors.some((error) => error.includes("cannot occur after the packet generation time")))
})
test("rejects approval timestamp before packet generation", () => {
  const packet = makeValidPacket()
  packet.manifest.approval.decidedAt = "2026-10-20T12:00:00.000Z"
  const result = validateEvidenceManifest(packet.manifest, { manifestPath: packet.manifestPath })
  assert.ok(result.errors.some((error) => error.includes("approval must occur at or after")))
})
test("requires evidence reviewer to be an accountable approver", () => {
  const packet = makeValidPacket()
  packet.manifest.gates[0].evidence[0].reviewer = "Unlisted Reviewer"
  const result = validateEvidenceManifest(packet.manifest, { manifestPath: packet.manifestPath })
  assert.ok(result.errors.some((error) => error.includes("reviewer must be one of the named accountable approvers")))
})
test("requires distinct independent approvers", () => {
  const packet = makeValidPacket()
  packet.manifest.approval.reviewers.security = packet.manifest.approval.reviewers.engineering
  const result = validateEvidenceManifest(packet.manifest, { manifestPath: packet.manifestPath })
  assert.ok(result.errors.some((error) => error.includes("must be distinct people")))
})
test("CLI creates a template using the current package version and refuses to overwrite it", () => {
  const target = join(temp, "cli-template.json")
  const first = spawnSync(process.execPath, [validatorScript, "--template", target], { encoding: "utf8" })
  assert.equal(first.status, 0, first.stderr)
  const generated = JSON.parse(readFileSync(target, "utf8"))
  assert.equal(generated.packageVersion, JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).version)
  const second = spawnSync(process.execPath, [validatorScript, "--template", target], { encoding: "utf8" })
  assert.equal(second.status, 2)
  assert.ok(second.stderr.includes("Refusing to overwrite"))
})
test("CLI refuses to approve the untouched blocked template", () => {
  const target = join(temp, "blocked-template.json")
  const generated = spawnSync(process.execPath, [validatorScript, "--template", target], { encoding: "utf8" })
  assert.equal(generated.status, 0)
  const validation = spawnSync(process.execPath, [validatorScript, "--validate", target], { encoding: "utf8" })
  assert.equal(validation.status, 1)
  assert.ok(validation.stdout.includes("NOT APPROVED"))
})
test("CLI approves only a complete packet whose artifacts validate", () => {
  const packet = makeValidPacket()
  writeFileSync(packet.manifestPath, `${JSON.stringify(packet.manifest, null, 2)}\n`)
  const validation = spawnSync(process.execPath, [validatorScript, "--validate", packet.manifestPath], { encoding: "utf8" })
  assert.equal(validation.status, 0, validation.stderr + validation.stdout)
  assert.ok(validation.stdout.includes("APPROVED evidence packet"))
})
test("rejects unresolved risks and unapproved decision", () => {
  const packet = makeValidPacket()
  packet.manifest.approval.unresolvedRisks = ["Payment reconciliation is not complete"]
  const result = validateEvidenceManifest(packet.manifest, { manifestPath: packet.manifestPath })
  assert.ok(result.errors.some((error) => error.includes("unresolved risks must be closed")))
})
rmSync(temp, { recursive: true, force: true })
console.log(`\nRelease evidence validator: ${passed}/22 tests passed`)
if (passed !== 22) process.exitCode = 1
