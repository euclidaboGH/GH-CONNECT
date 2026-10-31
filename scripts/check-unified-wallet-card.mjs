#!/usr/bin/env node
import { readFileSync } from 'node:fs'
const wallet = readFileSync('features/wallet/wallet-balance.tsx', 'utf8')
const screen = readFileSync('features/wallet/wallet-screen.tsx', 'utf8')
const checks = [
  ['wallet uses one combined PI/GHC balance card', /Unified PI and GHC wallet balances/.test(wallet)],
  ['PI earnings come from the authoritative withdrawable endpoint', /fetch\("\/api\/economy\/earnings\/withdrawable"/.test(wallet)],
  ['wallet API request bypasses cache', /cache: "no-store"/.test(wallet)],
  ['PI balance fails closed instead of fabricating a zero', /"Unavailable"/.test(wallet) && /setPiSnapshot\(null\)/.test(wallet)],
  ['PI and GHC are displayed separately, never summed', /PI and GHC are never added together/.test(wallet) && /GHC utility/.test(wallet)],
  ['PI display distinguishes withdrawable from available', /withdrawable · fees and eligibility apply/.test(wallet)],
  ['PI and GHC use separate transaction rails', /assetRail === "pi"/.test(screen) && /assetRail === "ghc"/.test(screen)],
  ['wallet refresh events refresh PI earnings', /ghc:earnings-refresh/.test(wallet) && /ghc:wallet-refresh/.test(wallet)],
  ['PI refreshes are time-bounded', /setTimeout\(\(\) => controller\.abort\(\), 10_000\)/.test(wallet)],
  ['overlapping PI refreshes cannot overwrite newer responses', /piRequestIdRef/.test(wallet) && /requestId === piRequestIdRef\.current/.test(wallet)],
  ['PI payout eligibility comes from the server response', /typeof data\.eligible !== \"boolean\"/.test(wallet) && /piSnapshot\.eligible/.test(wallet)],
  ['user can retry PI balance refresh directly', /Refresh PI balance/.test(wallet) && /disabled=\{piLoading\}/.test(wallet)],
  ['PI identity linkage state is explicit', /piWalletLinked/.test(wallet) && /Link your Pi identity/.test(wallet)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nUnified wallet card: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
