#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const screen = readFileSync('features/wallet/wallet-screen.tsx', 'utf8')
const balance = readFileSync('features/wallet/wallet-balance.tsx', 'utf8')
const statement = readFileSync('features/wallet/wallet-statement.ts', 'utf8')
const provider = readFileSync('contexts/domains/wallet-read-provider.tsx', 'utf8')
const checks = [
  ['balance visibility preference is session-scoped', /sessionStorage\.getItem\("ghc\.wallet\.balance-hidden"\)/.test(screen) && !/localStorage\.setItem\("ghc\.wallet\.balance-hidden"/.test(screen)],
  ['privacy toggle writes only the hidden preference', /sessionStorage\.setItem\("ghc\.wallet\.balance-hidden", "1"\)/.test(screen)],
  ['GHC available balance remains server-confirmed before display', /ghcVerified \? mask\(balance\) : "Unavailable"/.test(balance)],
  ['PI balance remains independently server sourced', /fetch\("\/api\/economy\/earnings\/withdrawable"/.test(balance)],
  ['PI and GHC balances are never combined', /PI and GHC are never added together/.test(balance)],
  ['GHC escrow lock is explicitly surfaced', /Escrow locked/.test(balance) && /escrowLocked=\{escrowLocked\}/.test(screen)],
  ['pending GHC statement movement is separated from settled totals', /pending \+= Math\.abs\(row\.amount\)/.test(statement)],
  ['failed, reversed, cancelled and expired rows are excluded from totals', /failed", "reversed", "cancelled", "canceled", "expired/.test(statement)],
  ['statement summary is derived from filtered loaded GHC records', /summarizeGhcStatement\(filteredTxs\)/.test(screen)],
  ['history makes the loaded-record limit transparent', /latest \{txs\.length\} locally hydrated GHC records/.test(screen) && /older-record pagination is not available/.test(screen)],
  ['transaction search and date filters remain available', /Search GHC transactions by description or reference/.test(screen) && /txDateRange/.test(screen)],
  ['manual refresh awaits a fresh authoritative server snapshot', /await refreshWalletAuthority\(\)/.test(screen) && /const serverConfirmed = await refreshWalletAuthority\(\)/.test(screen)],
  ['wallet read refresh reports whether the server snapshot was confirmed', /refresh: \(\) => Promise<boolean>/.test(provider) && /return true/.test(provider) && /return false/.test(provider)],
  ['wallet financial mutation remains outside the presentation helper', /presentation-only and never changes ledger authority/.test(statement)],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed += 1
}
console.log(`\nPhase 2 Wallet product transformation: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
