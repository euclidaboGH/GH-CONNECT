#!/usr/bin/env node
/** Phase 13 GHC/Pi transaction record export contracts; network/DB independent. */
import fs from 'node:fs'
import path from 'node:path'
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const ghc = read('components/ghc/ghc-transaction-detail.tsx')
const pi = read('components/ghc/pi-payment-detail.tsx')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const checks = [
  ['release/package/lock versions agree', /^0\.\d+\.\d+$/.test(pkg.version) && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['Phase 13 report exists', fs.existsSync(path.join(process.cwd(), 'docs/archive/phase-notes/PHASE-13-UNIFIED-TRANSACTION-RECORDS.md'))],
  ['GHC export uses persisted ledger transaction', /if \(!tx\) return/.test(ghc) && /Transaction ID: \${tx.id}/.test(ghc)],
  ['GHC export includes status and timestamps without inventing posted time', /Status: \${tx.status}/.test(ghc) && /tx\.postedAt \? formatWhen\(tx\.postedAt\) : "Not recorded"/.test(ghc)],
  ['GHC export includes stable references and source event', /Reference ID: \${tx\.referenceId \|\| "Not provided"}/.test(ghc) && /Source event:/.test(ghc)],
  ['GHC export is curated and avoids arbitrary metadata dumps', /tx\.sourceEvent/.test(ghc) && !/JSON\.stringify\(tx\.metadata/.test(ghc)],
  ['GHC receipt disclaims external settlement proof', /not an external bank or Pi settlement receipt/.test(ghc)],
  ['GHC has copy/share/download controls', /copyReceipt/.test(ghc) && /navigator\.share/.test(ghc) && /URL\.createObjectURL/.test(ghc)],
  ['GHC copy/share/download outcomes are announced accessibly', /role="status"/.test(ghc) && /Transaction record downloaded/.test(ghc)],
  ['GHC detail closes on Escape', /event\.key === "Escape"/.test(ghc)],
  ['Pi receipt remains present and independent', /GreenHaven · Pi Payment Receipt \/ Record/.test(pi) && /This is a copy of the payment-intent record/.test(pi)],
  ['No ledger or payment mutation is added to detail components', !/fetch\([^\n]*method:\s*["'](POST|PUT|PATCH|DELETE)/.test(ghc) && !/fetch\([^\n]*method:\s*["'](POST|PUT|PATCH|DELETE)/.test(pi)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 13 unified transaction record exports: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
