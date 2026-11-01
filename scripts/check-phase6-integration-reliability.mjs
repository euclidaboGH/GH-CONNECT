#!/usr/bin/env node
/** Phase 6 cross-feature integration contracts. Source-only; no DB/provider calls. */
import fs from 'node:fs'
import path from 'node:path'
const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const exists = (p) => fs.existsSync(path.join(root, p))
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const identity = read('lib/server/identity/public-profile-hydration.ts')
const referral = read('app/api/referral/attribute/route.ts')
const feed = read('app/api/social/feed/route.ts')
const search = read('app/api/social/search/route.ts')
const curation = read('app/api/social/posts/[id]/curation/route.ts')
const voteWeight = read('lib/server/ghpv/vote-weight.ts')
const wallet = read('app/api/economy/wallet/[userId]/route.ts')
const walletSummary = read('app/api/economy/wallet/summary/route.ts')
const claim = read('app/api/economy/rewards/claim/route.ts')
const matured = read('app/api/economy/rewards/claim-matured/route.ts')
const economyDb = read('lib/server/economy/db.ts')
const fulfillment = read('app/api/payments/fulfill/route.ts')
const rpc = read('lib/server/social/rpc.ts')
const sessions = read('lib/server/identity/session-store.ts')
const piIdentity = read('lib/server/identity/pi-identity-store.ts')
const messaging = read('app/api/messaging/conversations/[conversationId]/messages/route.ts')
const checks = [
  ['package, lock root, and lock version agree', pkg.version === lock.version && lock.packages?.['']?.version === pkg.version],
  ['app release metadata matches package version', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['Phase 6 integration release note exists', exists('docs/archive/phase-notes/PHASE-6-CROSS-FEATURE-INTEGRATION-RELIABILITY.md')],
  ['shared public identity hydration uses a narrow public-field allowlist', /select:\s*"gh_user_id,display_name,username,photos"/.test(identity)],
  ['public identity hydration uses no-store reads', /cache:\s*"no-store"/.test(identity)],
  ['referral ID resolution uses canonical public identity directory', /resolvePublicIdentity\(asGh\)/.test(referral) && !/from\("gh_profiles"\)/.test(referral)],
  ['referral attribution authenticates actor and blocks self-referral', /resolveAuthenticatedUser\(request\.headers\)/.test(referral) && /SELF_REFERRAL/.test(referral)],
  ['main feed hydrates canonical author identity', /hydratePublicProfileIdentity/.test(feed)],
  ['search hydrates identity across result types', ['hydratedPeople','hydratedPosts','hydratedVideos','hydratedCreators'].every((x) => search.includes(x))],
  ['curation strips client authority fields', /stripClientAuthority\(body\)/.test(curation)],
  ['curation weight fails closed without persisted intelligence', /CURATION_INTELLIGENCE_UNAVAILABLE/.test(voteWeight)],
  ['curation does not use formula-only fallback', !/fallbackWeight|calculateFallbackWeight/.test(voteWeight)],
  ['wallet path binds requested user to authenticated owner', /resolveAuthenticatedUser\(request\.headers\)/.test(wallet) && /requireSameUser\(auth, userId\)/.test(wallet)],
  ['wallet ledger outage fails closed instead of inventing balance', /if \(!rows\)/.test(wallet) && /Failed to load wallet ledger/.test(wallet)],
  ['wallet summary derives user from authentication', /resolveAuthenticatedUser\(request\.headers\)/.test(walletSummary) && /ghc_wallet_v2_snapshot/.test(walletSummary)],
  ['reward claim derives owner and amount from authenticated server context', /rpcClaimPending\(auth\.userId, holdId\)/.test(claim) && /void body\.amount/.test(claim) && /void body\.userId/.test(claim)],
  ['matured reward reconciliation requires durable database', /isDatabaseConfigured\(\)/.test(matured) && /rpcClaimPending\(auth\.userId/.test(matured)],
  ['matured reward candidate query is restricted to Daily Claim source', /rpcListMaturedDailyClaimHolds/.test(matured) && /DAILY_CLAIM_V12/.test(economyDb)],
  ['payment fulfillment requires authenticated owner match', /resolveAuthenticatedUser\(request\.headers\)/.test(fulfillment) && /intent\.userId !== auth\.userId/.test(fulfillment)],
  ['payment fulfillment requires durable completed intent before settlement', /intent\.status !== "COMPLETED"/.test(fulfillment) && /PAYMENT_NOT_COMPLETED/.test(fulfillment)],
  ['payment fulfillment has explicit idempotent fulfilled path', /intent\.status === "FULFILLED"/.test(fulfillment) && /idempotent: true/.test(fulfillment)],
  ['social RPC keeps service-role key server-side and no-store', /Authorization:\s*`Bearer \$\{env\.supabaseServiceRoleKey\}`/.test(rpc) && /cache:\s*"no-store"/.test(rpc)],
  ['social RPC does not probe legacy RPC variants after canonical failure', /return socialRpcOnce\(fn, body\)/.test(rpc)],
  ['production session creation rejects memory-only durability', /SESSION_DURABILITY_UNAVAILABLE/.test(sessions) && /if \(isProd\)/.test(sessions)],
  ['production Pi identity rejects memory-only durability', /IDENTITY_DURABILITY_UNAVAILABLE/.test(piIdentity) && /isProductionRuntime\(\)/.test(piIdentity)],
  ['messaging endpoint authenticates before resolving the requested conversation', (() => { const get = messaging.slice(messaging.indexOf('export async function GET')); return get.indexOf('resolveAuthenticatedUser') >= 0 && get.indexOf('resolveAuthenticatedUser') < get.indexOf('await ctx.params') })()],
  ['server-only secrets are not exposed in public env template', !/^NEXT_PUBLIC_(?:SUPABASE_SERVICE_ROLE_KEY|PI_API_KEY|PI_SERVER_API_KEY|PI_WALLET_PRIVATE_SEED)=/m.test(read('.env.example'))],
  ['no Phase 6 database migration is introduced by this source-only gate', !fs.readdirSync(path.join(root, 'supabase/migrations')).some((n) => /phase6.*integration/i.test(n))],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 6 integration reliability: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
