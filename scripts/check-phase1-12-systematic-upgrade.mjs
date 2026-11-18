#!/usr/bin/env node
/** Network/DB-independent regression contract for v0.157.3 systemic fixes. */
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => readFileSync(join(root, p), "utf8")
const pkg = JSON.parse(read("package.json"))
const lock = JSON.parse(read("package-lock.json"))
const domain = read("lib/domains/economy-domain.ts")
const transfer = read("app/api/economy/transfers/route.ts")
const staticSuite = read("scripts/verify-phase14-static.mjs")
const checks = [
  ["release version is synchronized across package, lock, app and manifest", /^\d+\.\d+\.\d+$/.test(pkg.version) && lock.version === pkg.version && lock.packages?.[""].version === pkg.version && read("lib/app-release.ts").includes(`APP_RELEASE_VERSION = "${pkg.version}"`) && read("VERIFIED_MANIFEST.txt").includes(`project_version=${pkg.version}`)],
  ["domain spend rejects non-positive input before creating a reference", /const abs = Number\(input\.amount\)/.test(domain) && /Invalid spend amount/.test(domain)],
  ["P2P send no longer turns negative user input into positive value", /const amount = Number\(input\.amount\)\s+const partyErr = validatePeerParty\(input\.toUserId\)/.test(domain)],
  ["GHC request creation no longer turns negative input into a positive request", /const amount = Number\(input\.amount\)\s+const partyErr = validatePeerParty\(input\.fromUserId\)/.test(domain)],
  ["request fulfilment validates supplied or persisted amount before sending", /rawAmount = input\.amount \?\? reqTx\?\.amount/.test(domain) && /Invalid transfer request amount/.test(domain)],
  ["API notification preserves the validated amount instead of applying absolute-value coercion", !/amount: Math\.abs\(amount\)/.test(transfer)],
  ["systematic upgrade regression gate is registered", staticSuite.includes('"check-phase1-12-systematic-upgrade.mjs"')],
  ["source-level checks explicitly do not claim live database acceptance", /network\/DB independent/i.test(staticSuite) && /operator acceptance|operational acceptance/i.test(read("docs/PHASE-1-12-SYSTEM-WIDE-ACCEPTANCE.md"))],
]
let failures = 0
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failures++ }
console.log(`\nSystematic upgrade audit: ${checks.length - failures}/${checks.length} passed`)
if (failures) process.exit(1)
