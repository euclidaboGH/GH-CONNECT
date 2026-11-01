#!/usr/bin/env node
/** Source-level regression checks for the Phase 25 premium UI pass. */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const feed = read('components/ghc/enhanced-feed-screen.tsx')
const profile = read('components/ghc/profile-screen.tsx')
const wallet = read('features/wallet/wallet-screen.tsx')
const membership = read('components/ghc/premium-membership-screen.tsx')
const rewards = read('components/ghc/rewards-centre-screen.tsx')
const css = read('app/globals.css')
const checks = [
  ['feed remains an accessible named region', feed.includes('aria-label="GreenHaven community feed"')],
  ['feed has a constrained premium content column', feed.includes('gh-premium-feed-list') && css.includes('.gh-premium-feed-list {')],
  ['profile keeps real counts and adds a styled metrics surface', profile.includes('gh-premium-profile-stats') && css.includes('.gh-premium-profile-stats button')],
  ['wallet metrics retain authoritative balance fields', wallet.includes('gh-premium-wallet-metrics') && wallet.includes('balance={balance}')],
  ['membership presentation does not replace server entitlement status', membership.includes('gh-premium-membership-content') && membership.includes('membershipAuthorityReady')],
  ['Rewards Centre is a named accessible region', rewards.includes('aria-label="GreenHaven Rewards Centre"')],
  ['dark theme styling is included for the premium surfaces', css.includes('.dark :is(.gh-world-feed, .gh-world-rewards, .gh-world-wallet, .gh-world-membership, .gh-world-profile)')],
  ['reduced-motion preference remains supported', css.includes('@media (prefers-reduced-motion: reduce)') && css.includes('.gh-premium-feed-toolbar')],
  ['focus and touch-safe behavior remains covered by shared app rules', css.includes('--gh-focus-outline') && css.includes('touch-action: manipulation')],
  ['the five-section polish is explicitly presentation-only', css.includes('no balance, entitlement, claim, or payment authority moves client-side')],
]
let failures = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failures++
}
console.log(`\nPhase 25 premium UI contract: ${checks.length - failures}/${checks.length} passed`)
process.exit(failures ? 1 : 0)
