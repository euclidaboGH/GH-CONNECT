#!/usr/bin/env node
import { readFileSync } from 'node:fs'
const screen = readFileSync('features/wallet/wallet-screen.tsx','utf8')
const balance = readFileSync('features/wallet/wallet-balance.tsx','utf8')
const header = readFileSync('features/wallet/wallet-header.tsx','utf8')
const daily = readFileSync('app/api/economy/rewards/daily/route.ts','utf8')
const prompt = readFileSync('components/ghc/daily-claim-prompt.tsx','utf8')
const checks = [
 ['daily claim durable notification uses authoritative amount', /authoritativeClaimAmount/.test(daily) && /GHC_REWARD_CLAIMED/.test(daily)],
 ['daily claim notification refuses zero or invalid amount', /res\.serverAmount > 0/.test(prompt) && /!res\.alreadyClaimed/.test(prompt)],
 ['wallet has persistent standard back navigation', /sticky top-0/.test(header) && /aria-label="Back"/.test(header)],
 ['wallet hero uses premium layered card treatment', /linear-gradient/.test(balance) && /rounded-\[1\.75rem\]/.test(balance)],
 ['main wallet does not render transaction list outside history sheet', /showFullHistory && tab === "activity"/.test(screen)],
 ['history remains available from primary wallet action', /setShowFullHistory\(true\)/.test(screen) && /onActivity/.test(screen)],
 ['redundant balance explainer removed from main wallet', !/title="PI & GHC in one wallet"/.test(screen)],
 ['redundant main-screen Open History promo removed', !/Open History/.test(screen)],
]
let failed=0
for (const [label,ok] of checks){ console.log(`${ok?'PASS':'FAIL'} ${label}`); if(!ok) failed++ }
console.log(`\nWallet/claim UX contract: ${checks.length-failed}/${checks.length} passed`)
process.exit(failed?1:0)
