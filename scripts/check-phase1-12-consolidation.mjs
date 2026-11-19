#!/usr/bin/env node
/** Network-independent audit for the Phase 1 foundation release. */
import { readFileSync, existsSync, lstatSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"
import { readProjectDoc, hasProjectDoc } from "./lib/read-project-doc.mjs"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => readFileSync(join(root, p), "utf8")
const pkg = JSON.parse(read("package.json"))
const lock = JSON.parse(read("package-lock.json"))
const checks = []
const test = (name, condition) => { checks.push([name, Boolean(condition)]); console.log(`${condition ? "PASS" : "FAIL"} ${name}`) }
test("package version is the consolidated release", /^\d+\.\d+\.\d+$/.test(pkg.version))
test("lockfile root version matches package", lock.version === pkg.version && lock.packages?.[""]?.version === pkg.version)
test("application release version matches package", read("lib/app-release.ts").includes(`APP_RELEASE_VERSION = "${pkg.version}"`))
test("verified manifest version matches package", read("VERIFIED_MANIFEST.txt").includes(`project_version=${pkg.version}`))
test("Phase 1–12 consolidation report exists", hasProjectDoc("docs/PHASE-1-12-SYSTEM-WIDE-ACCEPTANCE.md"))
const consolidationReport = readProjectDoc("docs/PHASE-1-12-SYSTEM-WIDE-ACCEPTANCE.md")
test("consolidation report is explicitly frozen at its RUN372 historical baseline", consolidationReport.includes("HISTORICAL SNAPSHOT — FROZEN AT 0.338.101") && consolidationReport.includes("Current audit status (v0.338.101)"))
test("consolidation report labels prior release notes as historical", /Historical v0\.152\.0 hardening delta/.test(consolidationReport))
test("project-truth current version agrees with package", read("docs/PROJECT_TRUTH.md").includes(`**Current source version:** \`${pkg.version}\``))
test("Phase 3 recovery report exists", hasProjectDoc("docs/PHASE-03-DATABASE-INTEGRITY-RECOVERY.md"))
test("Phase 4 recovery gate report exists", hasProjectDoc("docs/PHASE-04-RECOVERY-RELEASE-GATE.md"))
test("Phase 5 design system report exists", hasProjectDoc("docs/PHASE-05-BRANDING-DESIGN-SYSTEM.md"))
test("Phase 6 navigation report exists", hasProjectDoc("docs/PHASE-06-APP-SHELL-NAVIGATION-ONBOARDING.md"))
test("Phase 7 social report exists", hasProjectDoc("docs/PHASE-07-SOCIAL-EXPERIENCE-RELIABILITY.md"))
test("Phase 8 wallet report exists", hasProjectDoc("docs/PHASE-08-WALLET-FINANCIAL-RELIABILITY.md"))
test("Phase 9 transaction report exists", hasProjectDoc("docs/PHASE-09-WALLET-TRANSACTION-INTEGRATION.md"))
test("Phase 10 marketplace report exists", hasProjectDoc("docs/PHASE-10-MARKETPLACE-ORDER-FULFILMENT-INTEGRITY.md"))
test("Phase 11 reconciliation report exists", hasProjectDoc("docs/PHASE-11-WALLET-CROSS-FEATURE-RECONCILIATION.md"))
test("Phase 12 release report exists", hasProjectDoc("docs/PHASE-12-FINAL-INTEGRATION-RELEASE-READINESS.md"))
const statics = read("scripts/verify-phase14-static.mjs")
test("consolidated audit is registered in static verification", statics.includes('"check-phase1-12-consolidation.mjs"'))
test("the old embedded duplicate project tree is absent", !existsSync(join(root, "greenhaven-upgrade-next")))
test("release documentation distinguishes source checks from operator acceptance", /operator verification still required|operator acceptance|operational acceptance/i.test(readProjectDoc("docs/PHASE-1-12-SYSTEM-WIDE-ACCEPTANCE.md")))
test("Node runtime remains pinned to the project requirement", read(".nvmrc").trim() === "24.15.0")
test("the static gate remains network/DB independent", /network\/DB independent/i.test(statics))
const report = join(root, "docs/archive/historical-implementation-records/docs__PHASE-1-12-SYSTEM-WIDE-ACCEPTANCE.md")
try { const st = lstatSync(report); test("consolidation report is a regular file", st.isFile() && !st.isSymbolicLink()) } catch { test("consolidation report is a regular file", false) }
const failed = checks.filter(([, ok]) => !ok).length
console.log(`\nPhase 1–12 consolidation: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
