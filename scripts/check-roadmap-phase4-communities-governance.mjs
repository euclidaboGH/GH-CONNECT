#!/usr/bin/env node
/** Phase 4 community resilience/governance regression contracts. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const screen = readFileSync('components/ghc/communities-screen.tsx', 'utf8')
const joinStart = screen.indexOf('const ensureInStateAndJoin = async')
const joinEnd = screen.indexOf('const handleLeave = async', joinStart)
const join = screen.slice(joinStart, joinEnd)
const leaveStart = screen.indexOf('const handleLeave = async')
const leaveEnd = screen.indexOf('const boardPostsFor =', leaveStart)
const leave = screen.slice(leaveStart, leaveEnd)
const postStart = screen.indexOf('const handleBoardPost = async')
const postEnd = screen.indexOf('\n  if (selected)', postStart)
const post = screen.slice(postStart, postEnd)
const checks = [
  ['offline join reports a definite unsuccessful result', /offline[^]*?return false/.test(join)],
  ['join busy state is reset in finally', /finally\s*\{\s*setJoinBusy\(false\)/.test(join)],
  ['join only mirrors local membership after domain success', /if \(ok\)[\s\S]*?communityLocalCacheAllowed\(\)/.test(join)],
  ['join failure remains visible to the user', /setJoinError\(msg\)/.test(join) && /addToast\(msg, "error"\)/.test(join)],
  ['leave network rejection is caught locally', /try\s*\{\s*const ok = await leaveCommunity\(id\)/.test(leave) && /catch\s*\{[\s\S]*?Could not confirm leaving/.test(leave)],
  ['leave cache changes only after successful domain response', /if \(ok\)[\s\S]*?setLocalJoined/.test(leave)],
  ['board post rejection is caught locally', /try\s*\{\s*const ok = await createBoardPost/.test(post) && /catch\s*\{/.test(post)],
  ['production board post failures do not become fake local posts', /if \(!allowLocalBoardFallback\(\)\)[\s\S]*?Could not confirm your board post/.test(post)],
  ['local board fallback remains explicitly gated', /allowLocalBoardFallback\(\)/.test(post)],
  ['offline leave exits before invoking the domain mutation', leave.indexOf('You are offline — leave when reconnected') >= 0 && leave.indexOf('You are offline — leave when reconnected') < leave.indexOf('const ok = await leaveCommunity(id)')],
]
let failed = 0
for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  if (!pass) failed++
}
console.log(`\nPhase 4 communities/governance resilience: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0, 'Community resilience regression checks failed')
