#!/usr/bin/env node
/** Phase 7 runtime-hardening source contracts; no credentials, DB, or provider calls. */
import fs from 'node:fs'
import path from 'node:path'
const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const exists = (p) => fs.existsSync(path.join(root, p))
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const webhook = read('app/api/webhooks/paystack/route.ts')
const signature = read('lib/server/payouts/paystack.ts')
const message = read('app/api/messaging/conversations/[conversationId]/messages/route.ts')
const claim = read('app/api/economy/rewards/claim/route.ts')
const fulfill = read('app/api/payments/fulfill/route.ts')
const referral = read('app/api/referral/attribute/route.ts')
const wallet = read('app/api/economy/wallet/[userId]/route.ts')
const curation = read('app/api/social/posts/[id]/curation/route.ts')
const checks = [
  ['package and lockfile versions agree', pkg.version === lock.version && lock.packages?.['']?.version === pkg.version],
  ['release metadata matches package version', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['Phase 7 report exists', exists('docs/archive/phase-notes/PHASE-7-RUNTIME-INTEGRATION-HARDENING.md')],
  ['Phase 7 operator smoke script exists', exists('scripts/operator-phase7-runtime-hardening.mjs')],
  ['Paystack webhook caps raw payload size before parsing', webhook.indexOf('raw.length > 256_000') >= 0 && webhook.indexOf('raw.length > 256_000') < webhook.indexOf('JSON.parse(raw)')],
  ['Paystack webhook verifies signature before processing event', webhook.indexOf('verifyPaystackSignature(raw') >= 0 && webhook.indexOf('verifyPaystackSignature(raw') < webhook.indexOf('JSON.parse(raw)')],
  ['Paystack signature uses HMAC-SHA512 and timing-safe comparison', /createHmac\("sha512"/.test(signature) && /timingSafeEqual\(/.test(signature)],
  ['Paystack webhook rejects invalid signature', /INVALID_WEBHOOK_SIGNATURE/.test(webhook)],
  ['Paystack webhook uses stable provider event key for idempotency', /p_event_key:\s*`\$\{eventName\}:\$\{providerTransferId\}`/.test(webhook)],
  ['Paystack webhook stores a hash of received evidence', /p_evidence_hash: createHash\("sha256"\)/.test(webhook)],
  ['Paystack webhook RPC is no-store and has a timeout', /cache:\s*"no-store"/.test(webhook) && /AbortSignal\.timeout\(15_000\)/.test(webhook)],
  ['messaging read authenticates before conversation lookup', (() => { const s = message.slice(message.indexOf('export async function GET')); return s.indexOf('resolveAuthenticatedUser') >= 0 && s.indexOf('resolveAuthenticatedUser') < s.indexOf('await ctx.params') })()],
  ['messaging write authenticates and rate-limits by actor', (() => { const s = message.slice(message.indexOf('export async function POST')); return s.indexOf('resolveAuthenticatedUser') >= 0 && s.indexOf('checkRateLimit(`msg-send:${auth.userId}`') > s.indexOf('resolveAuthenticatedUser') })()],
  ['messaging ignores client-supplied actor identity', ['body.senderId','body.userId','body.authorId','body.actorId'].every((s) => message.includes(`void ${s}`))],
  ['messaging media attachments require server-side ownership validation', /validateOwnedMediaAttachments\(/.test(message)],
  ['reward claim authenticates and rate-limits before claim', (() => { const s = claim.slice(claim.indexOf('export async function POST')); return s.indexOf('resolveAuthenticatedUser') >= 0 && s.indexOf('resolveAuthenticatedUser') < s.indexOf('rpcClaimPending') && s.indexOf('checkRateLimit') < s.indexOf('rpcClaimPending') })()],
  ['reward claim ignores client-supplied financial authority', ['body.amount','body.userId','body.balance'].every((s) => claim.includes(`void ${s}`))],
  ['payment fulfillment binds intent to authenticated owner', /intent\.userId !== auth\.userId/.test(fulfill)],
  ['payment fulfillment requires completed durable intent', /intent\.status !== "COMPLETED"/.test(fulfill) && /PAYMENT_NOT_COMPLETED/.test(fulfill)],
  ['payment fulfillment returns idempotent success for already-fulfilled intent', /intent\.status === "FULFILLED"/.test(fulfill) && /idempotent: true/.test(fulfill)],
  ['referral attribution authenticates and blocks self-referral', /resolveAuthenticatedUser\(request\.headers\)/.test(referral) && /SELF_REFERRAL/.test(referral)],
  ['wallet reads bind requested user to authenticated owner', /requireSameUser\(auth, userId\)/.test(wallet)],
  ['curation strips client authority and fails closed without intelligence', /stripClientAuthority\(body\)/.test(curation) && /CURATION_INTELLIGENCE_UNAVAILABLE/.test(curation)],
  ['live operator smoke refuses unsafe base URL configuration', /requireE2eBaseUrl/.test(read('lib/e2e/resolve-base-url.mjs'))],
  ['Node 24 runtime requirement remains pinned', read('.nvmrc').trim().startsWith('24.') && /"node":\s*"\^24\./.test(read('package.json'))],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 7 runtime hardening: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
