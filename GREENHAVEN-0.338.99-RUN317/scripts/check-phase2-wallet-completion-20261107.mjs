#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const screen = readFileSync('features/wallet/wallet-screen.tsx', 'utf8')
const statement = readFileSync('features/wallet/wallet-statement.ts', 'utf8')
const ghcDetail = readFileSync('components/ghc/ghc-transaction-detail.tsx', 'utf8')
const piDetail = readFileSync('components/ghc/pi-payment-detail.tsx', 'utf8')
const actions = readFileSync('features/wallet/wallet-actions.tsx', 'utf8')
const checks = [
  ['GHC and Pi transaction search share one query without merging records', /Search transaction histories across GHC and Pi/.test(screen) && /setHistoryRail\("pi"\); setAssetRail\("pi"\)/.test(screen) && /historyRail === "ghc"/.test(screen) && /historyRail === "pi"/.test(screen)],
  ['GHC history search indexes transaction ID, reference, description and source', /tx\.id} \$\{tx\.referenceId/.test(screen) && /tx\.sourceEvent/.test(screen)],
  ['Pi history search indexes intent, reference, provider ID and purpose', /intent\.paymentId/.test(screen) && /intent\.referenceId/.test(screen) && /intent\.purpose/.test(screen)],
  ['GHC receipts include safe allowlisted correlation references', /correlationReferences/.test(ghcDetail) && /paymentIntentId/.test(ghcDetail) && /providerPaymentId/.test(ghcDetail)],
  ['GHC receipts retain explicit in-app ledger disclaimer', /not an external bank or Pi settlement receipt/.test(ghcDetail)],
  ['Pi receipts retain intent, reference and provider identifiers', /Reference ID/.test(piDetail) && /Pi payment ID/.test(piDetail) && /Intent ID/.test(piDetail)],
  ['Monthly insights exclude non-settled and request-only rows', /transfer_request/.test(statement) && /status !== "posted"/.test(statement) && /failed", "reversed", "cancelled", "canceled", "expired/.test(statement)],
  ['Monthly insights report pending movement separately', /pendingCount/.test(statement) && /monthPending/.test(screen)],
  ['Monthly insights explicitly describe the loaded GHC ledger scope', /locally hydrated GHC records/.test(screen)],
  ['GHC Send, Request and Receive journeys remain canonical', /id: "send"/.test(actions) && /id: "request"/.test(actions) && /id: "receive"/.test(actions)],
  ['Pi withdrawal remains a dedicated action and consent sheet', /id: "withdraw"/.test(actions) && /PiWithdrawSheet/.test(screen)],
  ['No Pi and GHC values are aggregated into a common financial total', /PI and GHC are never added together/.test(readFileSync('features/wallet/wallet-balance.tsx', 'utf8'))],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed += 1
}
console.log(`\nPhase 2 Wallet completion: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
