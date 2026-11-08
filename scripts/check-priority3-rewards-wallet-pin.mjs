#!/usr/bin/env node
/** Priority 3 coordinated Rewards UX + Wallet withdrawal PIN discoverability. */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const read = (path) => readFileSync(path, 'utf8')
const rewards = read('components/ghc/rewards-centre-screen.tsx')
const pinCard = read('components/ghc/wallet-withdrawal-pin-card.tsx')
const wallet = read('features/wallet/wallet-screen.tsx')
const walletTools = read('features/wallet/wallet-tools.tsx')
const balance = read('features/wallet/wallet-balance.tsx')
const pinRoute = read('app/api/identity/withdrawal-pin/route.ts')
const pinService = read('lib/server/identity/withdrawal-pin.ts')
const cancelRoute = read('app/api/economy/earnings/withdrawals/cancel/route.ts')
const ledger = read('lib/server/earnings/unified-ledger.ts')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['Wallet exposes a dedicated withdrawal PIN card in its security destination', wallet.includes('<WalletWithdrawalPinCard />') && wallet.includes('id="ghc-wallet-security"') && walletTools.includes('Security & PIN')],
  ['PIN status is read from the authenticated no-store server endpoint', pinCard.includes('fetch("/api/identity/withdrawal-pin"') && pinCard.includes('credentials: "include"') && pinCard.includes('cache: "no-store"')],
  ['PIN creation is offered only after server confirms no PIN is configured', pinCard.includes('status?.ok === true && status.configured === false') && pinCard.includes('status.configured !== false')],
  ['PIN creation requires two matching six-digit values', pinCard.includes('pin.length !== 6') && pinCard.includes('confirmPin.length !== 6') && pinCard.includes('pin !== confirmPin')],
  ['PIN creation uses the existing authenticated server action and never local storage', pinCard.includes('action: "set", pin, confirmPin') && !/localStorage|sessionStorage|console\.(log|debug).*pin/i.test(pinCard)],
  ['Existing PIN recovery journey remains available after configuration', pinCard.includes('<PinRecoveryPanel') && pinRoute.includes('action === "set"')],
  ['Server rejects weak PINs and refuses to overwrite an existing PIN', pinRoute.includes('isWeakPin(body.pin)') && pinService.includes('resolution=ignore-duplicates,return=representation') && pinService.includes('PIN_ALREADY_CONFIGURED')],
  ['PIN values are hashed server-side and are not returned by status endpoint', pinService.includes('scryptSync(pin, salt, 32)') && pinRoute.includes('getWithdrawalPinStatus') && !pinRoute.includes('pin_hash')],
  ['PIN is accurately scoped to Pi withdrawals, not advertised as universal transaction authorization', pinCard.includes('At present it protects Pi withdrawals; other transaction types keep their own authorization rules.')],
  ['Pi reserved funds are distinguished from eligible-to-withdraw funds', balance.includes('Eligible to withdraw') && balance.includes('Reserved for requests')],
  ['Reserved funds copy explains provider execution boundary', balance.includes('not spendable while those requests remain active') && balance.includes('cannot force-release them')],
  ['Release control is limited by authenticated server cancellation of unstarted requests', cancelRoute.includes('cancelUnstartedPayoutRequests(auth.userId)') && ledger.includes('gh_pi_earnings_payout_cancel_unstarted')],
  ['Rewards counts approved/eligible claims separately from under-review items', rewards.includes('row.validationStatus === "eligible" || row.validationStatus === "approved"') && rewards.includes('Under review / maturity')],
  ['Mission policy explicitly states achievements do not issue GHC or Pi', rewards.includes('mission completion does not issue GHC or Pi')],
  ['GHC rewards and Pi cashback remain separate journeys', rewards.includes('Two different rewards') && rewards.includes('<PiCashbackSummary />')],
  ['Rewards display does not gain client-side financial issuance authority', !/ledger\.insert|mintGhc|transferGhc|settleReward\s*\(/i.test(rewards)],
  ['Priority 3 contract is registered exactly once in prebuild and static verification', (pkg.scripts.prebuild.match(/check-priority3-rewards-wallet-pin\.mjs/g) || []).length === 1 && (pkg.scripts['verify:static'].match(/check-priority3-rewards-wallet-pin\.mjs/g) || []).length === 1],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
assert.equal(failed, 0, `${failed} Priority 3 checks failed`)
console.log(`Priority 3 Rewards + Wallet trust checks: ${checks.length}/${checks.length} passed`)
