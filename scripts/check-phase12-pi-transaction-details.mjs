#!/usr/bin/env node
/** Phase 12 transaction detail and portable receipt contracts; network/DB independent. */
import fs from 'node:fs'
import path from 'node:path'
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const wallet = read('features/wallet/wallet-screen.tsx')
const detail = read('components/ghc/pi-payment-detail.tsx')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const checks = [
  ['release/package/lock versions agree', pkg.version === lock.version && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['Phase 12 report exists', fs.existsSync(path.join(process.cwd(), 'PHASE-12-PI-TRANSACTION-DETAILS-RECEIPTS.md'))],
  ['Pi payment rows expose a details action', /View details/.test(wallet) && /setSelectedPiIntent\(intent\)/.test(wallet)],
  ['detail view is mounted with matching server reconciliation finding', /<PiPaymentDetail/.test(wallet) && /findings\.find\(\(item\) => item\.intentId === selectedPiIntent\.id\)/.test(wallet)],
  ['modal declares accessible dialog semantics', /role="dialog"/.test(detail) && /aria-modal="true"/.test(detail) && /aria-labelledby="pi-payment-detail-title"/.test(detail)],
  ['intent identifier is always displayed', /Intent ID/.test(detail) && /intent\.id/.test(detail)],
  ['reference and provider identifiers are displayed without fabrication', /Reference ID/.test(detail) && /Pi payment ID/.test(detail) && /Not provided/.test(detail)],
  ['amount is omitted as unavailable rather than fabricated as zero', /typeof intent\.amountPi === "number" \? intent\.amountPi/.test(detail) && /: "—"/.test(detail)],
  ['receipt includes stored status and creation time only', /Current status:/.test(detail) && /Created:/.test(detail) && /formattedDate\(intent\.createdAt\)/.test(detail)],
  ['receipt warns it is not proof of fulfilment', /not proof of provider settlement or product delivery/.test(detail)],
  ['no synthetic timestamped timeline is rendered', /no synthetic timeline is displayed/.test(detail) && !/new Date\(Date\.now\(\).*timeline/i.test(detail)],
  ['copy receipt remains client-side and timeline uses GET only', /navigator\.clipboard\.writeText\(receipt\)/.test(detail) && /fetch\(/.test(detail) && !/method:\s*["'](POST|PUT|PATCH|DELETE)/.test(detail)],
  ['share and text download options exist', /navigator\.share/.test(detail) && /URL\.createObjectURL/.test(detail) && /Receipt/.test(detail)],
  ['failed/incomplete records include duplicate-payment caution', /avoid accidental duplicate payment/.test(detail)],
  ['paid-but-unfulfilled status gets explicit guidance', /delivery or entitlement is not confirmed/.test(detail)],
  ['dialog can close with Escape', /event\.key === "Escape"/.test(detail)],
  ['GHC ledger remains a separate existing detail surface', /<GhcTransactionDetail/.test(wallet) && /GHC ledger transfers/.test(wallet)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 12 Pi transaction details/receipts: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
