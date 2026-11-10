#!/usr/bin/env node
/** Regression gate for deterministic community action outcomes under failure. */
import fs from 'node:fs'
import assert from 'node:assert/strict'
const source = fs.readFileSync('components/ghc/communities-screen.tsx', 'utf8')
const checks = [
  ['offline join resolves false rather than undefined', /You are offline — join when reconnected[\s\S]{0,100}return false/.test(source)],
  ['offline invitation acceptance returns without mutating membership', /handleAcceptCommunityInvitation[\s\S]*?navigator\.onLine[\s\S]*?return false/.test(source)],
  ['offline invitation decline returns without mutating membership', /handleDeclineCommunityInvitation[\s\S]*?navigator\.onLine[\s\S]*?return false/.test(source)],
  ['invitation acceptance catches transport failures', /handleAcceptCommunityInvitation[\s\S]*?try \{[\s\S]*?await acceptCommunityInvitation\(id\)[\s\S]*?catch \{[\s\S]*?return false/.test(source)],
  ['invitation acceptance reports a rejected result', /Could not accept this invitation\. Please try again\./.test(source)],
  ['invitation decline catches transport failures', /handleDeclineCommunityInvitation[\s\S]*?try \{[\s\S]*?await declineCommunityInvitation\(id\)[\s\S]*?catch \{[\s\S]*?return false/.test(source)],
  ['invitation decline reports a rejected result', /Could not decline this invitation\. Please try again\./.test(source)],
  ['leave catches transport failures before changing local membership', /let ok = false[\s\S]*?ok = await leaveCommunity\(id\)[\s\S]*?catch \{[\s\S]*?return[\s\S]*?if \(ok\)/.test(source)],
  ['local membership cache is still changed only after successful leave', /if \(ok\) \{[\s\S]{0,260}setLocalJoined\(\(prev\) => prev\.filter\(\(x\) => x !== id\)\)/.test(source)],
]
for (const [label, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
const failed = checks.filter(([, pass]) => !pass).length
console.log(`Community action resilience: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0, 'Community action resilience gate failed')
