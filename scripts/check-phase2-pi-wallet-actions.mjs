import fs from 'node:fs'
const actions = fs.readFileSync('features/wallet/wallet-actions.tsx', 'utf8')
const screen = fs.readFileSync('features/wallet/wallet-screen.tsx', 'utf8')
const dashboard = fs.readFileSync('components/ghc/unified-earnings-dashboard.tsx', 'utf8')
const checks = [
  ['PI withdraw card explains it opens the authoritative payout workflow', actions.includes('Open payout steps')],
  ['PI eligibility control is named for its actual task', actions.includes('Check payout status') && actions.includes('label: isPi ? "Eligibility"')],
  ['PI identity control is named for its actual task', actions.includes('label: isPi ? "Identity"') && actions.includes('Verify Pi account')],
  ['Wallet actions dispatch dedicated payout, eligibility and identity intents', screen.includes('ghc:pi-open-payout') && screen.includes('ghc:pi-open-eligibility') && screen.includes('ghc:pi-open-identity')],
  ['Dashboard listens for and cleans up each wallet intent', dashboard.includes('addEventListener("ghc:pi-open-identity"') && dashboard.includes('removeEventListener("ghc:pi-open-identity"') && dashboard.includes('addEventListener("ghc:pi-open-eligibility"') && dashboard.includes('addEventListener("ghc:pi-open-payout"')],
  ['Eligibility status is an actionable expandable module', dashboard.includes('Payout eligibility & status') && dashboard.includes('aria-expanded={eligibilityPanelOpen}') && dashboard.includes('Refresh eligibility')],
  ['Eligibility details include server reasons and deployment-gate explanation', dashboard.includes('snap.reasons.slice(0, 8)') && dashboard.includes('Payout request intake is disabled by the deployment gate')],
  ['Identity controls open in a dedicated expandable module', dashboard.includes('aria-label="Pi identity connection"') && dashboard.includes('Open identity controls') && dashboard.includes('aria-expanded={identityPanelOpen}')],
  ['Withdraw flow blocks early when identity is missing', dashboard.includes('Verify your Pi identity first. No withdrawal was submitted.')],
  ['Withdraw flow exposes eligibility reasons instead of silently disabling the action', dashboard.includes('setEligibilityPanelOpen(true)') && dashboard.includes('No withdrawal was submitted.')],
  ['Payout action is disabled only while authoritative state is loading or a request is active', dashboard.includes('disabled={requestingPayout || authorizingWallet || walletAuthLoading || loading || !snap}')],
  ['Existing ledger history rendering remains present', dashboard.includes('Recent ledger') && dashboard.includes('entries.slice(0, compact ? 3 : 6)')],
  ['Payout authorization and server-side identity gates remain intact', dashboard.includes('onAuthorizeWallet') && dashboard.includes('walletAuthActive !== true') && dashboard.includes('fetch("/api/identity/wallet-authorization"')],
]
let failures = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failures++
}
console.log(`\nPhase 2 Pi wallet actions: ${checks.length - failures}/${checks.length} passed`)
if (failures) process.exit(1)
