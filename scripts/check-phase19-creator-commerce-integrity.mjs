import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const route = read('app/api/social/tips/route.ts')
const idempotency = read('lib/server/creator/tip-idempotency.ts')
const store = read('lib/server/creator/store.ts')
const creatorRoute = read('app/api/social/creator/route.ts')
const panel = read('components/ghc/creator-studio-panel.tsx')

const checks = [
  ['tip endpoint accepts a request-scoped idempotency key', /Idempotency-Key/.test(route) && /body\.idempotencyKey/.test(route)],
  ['tip endpoint delegates key creation to the shared contract', /buildCreatorTipIdempotencyKey/.test(route)],
  ['same client key is stable across retries', /request:\$\{clientKey\}/.test(idempotency)],
  ['new client key creates a distinct tip action', /clientScoped: true/.test(idempotency) && /clientKey/.test(idempotency)],
  ['legacy clients retain deterministic fallback', /clientScoped: false/.test(idempotency) && /amt:\$\{amount\}/.test(idempotency)],
  ['malformed client idempotency keys are rejected', /INVALID_IDEMPOTENCY_KEY/.test(idempotency) && /clientKey\.length < 8/.test(idempotency)],
  ['GHC settlement verifies durable recipient, amount and currency binding', /gh_tip_intent_get_for_tipper/.test(route) && /found\.recipientId !== recipientId/.test(route) && /found\.currency !== \"GHC\"/.test(route)],
  ['PI payment-intent recovery rejects reused-key payload conflicts', /found\.recipientId !== recipientId/.test(route) && /TIP_INTENT_PAYLOAD_CONFLICT/.test(route)],
  ['creator post list rejects malformed upstream payloads', /INVALID_POSTS_RESPONSE/.test(store)],
  ['creator economy exposes per-source completeness', /sources: \{ piTips: boolean; ghcTips: boolean; postRewards: boolean; creatorLedger: boolean \}/.test(store)],
  ['creator economy fails closed when any contributing source is incomplete', /Object\.values\(sources\)\.every\(Boolean\)/.test(store)],
  ['creator API reports independent source health', /dataQuality/.test(creatorRoute) && /publishedPosts: posts\.ok/.test(creatorRoute)],
  ['creator rewards are not queried from a fabricated empty post set', /posts\.ok \? await getCreatorEconomySummary/.test(creatorRoute) && /creatorEconomy: economy\?\.ok === true/.test(creatorRoute)],
  ['Creator Studio hides unknown totals instead of rendering zero', /value === null \|\| value === undefined/.test(panel) && /creatorEconomy\?\.ok === true/.test(panel)],
  ['Creator Studio distinguishes unavailable posts from a true empty state', /publishedPosts === false/.test(panel)],
]

for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
assert.equal(checks.every(([, ok]) => ok), true, 'Phase 19 creator commerce integrity contract failed')
console.log(`Phase 19 creator commerce integrity: ${checks.length}/${checks.length} passed`)
