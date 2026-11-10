#!/usr/bin/env node
/** Phase 9 increment: prevent stale cross-account membership display and refresh races. */
import { readFileSync } from 'node:fs'
const read = (name) => readFileSync(name, 'utf8')
const screen = read('components/ghc/premium-membership-screen.tsx')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const roadmap = read('docs/PRODUCT-ROADMAP.md')
const checks = [
  ['Membership refresh requests are abortable', screen.includes('membershipRequestRef.current?.abort()') && screen.includes('signal: controller.signal')],
  ['Refresh responses are sequence-fenced against stale requests', screen.includes('requestSequence !== membershipRequestSequenceRef.current')],
  ['Unmount aborts outstanding membership reads', screen.includes('membershipRequestRef.current = null') && screen.includes('window.removeEventListener("ghc:wallet-auth-changed"')],
  ['Wallet identity changes clear prior account entitlement immediately', screen.includes('setServerStatus(null)') && screen.includes('setSuccessStatus(null)')],
  ['Wallet auth changes trigger fresh authoritative hydration', screen.includes('window.addEventListener("ghc:wallet-auth-changed"') && screen.includes('if (active !== false)') && screen.includes('void refreshMembershipFromServer()')],
  ['Session resume and visible-tab restoration refresh entitlement', screen.includes('ghc:session-resume') && screen.includes('document.visibilityState === "visible"')],
  ['Missing user identity is rejected rather than mapped to a shared placeholder', screen.includes('MEMBERSHIP_STATUS_IDENTITY_OR_TIER_INVALID') && !screen.includes('e.userId || e.user_id || "current-user"')],
  ['Unknown membership tiers are rejected', screen.includes('["free", "vip", "vvip"].includes(rawTier)')],
  ['Malformed active flags are rejected', screen.includes('typeof e.active !== "boolean"')],
  ['Paid status requires active=true and a future finite expiry', screen.includes('e.active !== true') && screen.includes('Number(expiresAt) <= Date.now()')],
  ['Timeouts and failed reads clear stale paid status', screen.includes('setServerStatusState("unavailable")') && screen.includes('setServerStatus(null)')],
  ['Membership store remains no-store on authoritative status endpoint', read('app/api/membership/status/route.ts').includes('Cache-Control') && read('app/api/membership/status/route.ts').includes('no-store')],
  ['Package and lockfile versions are synchronized', Boolean(pkg.version) && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version],
  ['Release metadata retains session-integrity guarantees in the current increment', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`) && release.includes('session integrity')],
  ['Membership source is complete with acceptance open; Feed and Wallet occupy priorities 1 and 2', roadmap.includes('| 4 | **Membership** |') && roadmap.includes('| 1 | **Feed** |') && roadmap.includes('Source implementation completed in 0.330.19;') && roadmap.includes('| 2 | **Wallet** |') && roadmap.includes('Source implementation completed in 0.330.20;')],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
if (failed) process.exit(1)
console.log(`Phase 9 membership session safety: ${checks.length}/${checks.length} checks passed.`)
