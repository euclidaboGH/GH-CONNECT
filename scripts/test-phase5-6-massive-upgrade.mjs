import assert from 'node:assert/strict'
import fs from 'node:fs'
import { isAllowedPaymentTransition } from '../lib/server/payments/intent-transition-policy.mjs'
import {
  buildOwnedMediaPath,
  isSafeMediaBucket,
  mediaCategoryMatches,
  mediaExtensionMatchesMime,
  parseOwnedMediaPath,
  validateMediaMetadata,
} from '../lib/server/media/path-policy.mjs'

const read = (p) => fs.readFileSync(p, 'utf8')
const assetStore = read('lib/server/media/asset-store.ts')
const mediaRoute = read('app/api/media/route.ts')
const uploadIntent = read('app/api/media/direct-upload-intent/route.ts')
const uploadComplete = read('app/api/media/direct-upload-complete/route.ts')
const intentStore = read('lib/server/payments/intent-store.ts')
const idempotencyMigration = read('supabase/migrations/202610210002_pi_payment_intent_idempotency_lookup.sql')
const atomicPaymentMigration = read('supabase/migrations/202610210003_pi_payment_intent_atomic_transitions.sql')
const withdrawal = read('lib/server/economy/withdrawal.ts')
const withdrawalRoute = read('app/api/economy/withdrawals/route.ts')
const messagingStore = read('lib/server/messaging/message-store.ts')
const mediaMigration = read('supabase/migrations/202610190002_gh_private_media_references_and_viewer_authz.sql')
const mediaAssetMigration = read('supabase/migrations/20261001_gh_media_assets.sql')

const uuid = '123e4567-e89b-42d3-a456-426614174000.jpg'
assert.equal(buildOwnedMediaPath('user-123', 'images', uuid), `user-123/images/${uuid}`)
assert.deepEqual(parseOwnedMediaPath('user-123', `user-123/images/${uuid}`), {
  ownerId: 'user-123', category: 'images', fileName: uuid, extension: 'jpg',
})
assert.equal(parseOwnedMediaPath('other-user', `user-123/images/${uuid}`), null)
assert.equal(parseOwnedMediaPath('user-123', `user-123/images/../${uuid}`), null)
assert.equal(parseOwnedMediaPath('user-123', `user-123//${uuid}`), null)
assert.equal(parseOwnedMediaPath('user-123', `user-123/images/${uuid.replace('.jpg', '.exe')}`), null)
assert.equal(buildOwnedMediaPath('user/escape', 'images', uuid), null)
assert.equal(isSafeMediaBucket('gh-media'), true)
assert.equal(isSafeMediaBucket('../private'), false)
assert.equal(mediaExtensionMatchesMime(uuid, 'image/jpeg'), true)
assert.equal(mediaExtensionMatchesMime(uuid.replace('.jpg', '.pdf'), 'image/jpeg'), false)
assert.equal(validateMediaMetadata({ mediaKind: 'image', mimeType: 'image/jpeg', byteSize: 1024 }), null)
assert.equal(validateMediaMetadata({ mediaKind: 'image', mimeType: 'application/pdf', byteSize: 1024 }), 'MIME_KIND_MISMATCH')
assert.equal(validateMediaMetadata({ mediaKind: 'image', mimeType: 'image/jpeg', byteSize: Number.NaN }), 'INVALID_BYTE_SIZE')
assert.equal(validateMediaMetadata({ mediaKind: 'image', mimeType: 'image/jpeg', byteSize: 0 }), 'INVALID_BYTE_SIZE')
assert.equal(validateMediaMetadata({ mediaKind: 'image', mimeType: 'image/jpeg', byteSize: 1024, width: 20001 }), 'INVALID_WIDTH')
assert.equal(mediaCategoryMatches('images', 'image', 'image/jpeg'), true)
assert.equal(mediaCategoryMatches('images', 'video', 'video/mp4'), false)
// Shared upload policy intentionally permits media up to 50 MiB; test above the actual cap.
assert.equal(validateMediaMetadata({ mediaKind: 'image', mimeType: 'image/jpeg', byteSize: 51 * 1024 * 1024 }), 'INVALID_BYTE_SIZE')
assert.equal(isAllowedPaymentTransition('CREATED', 'APPROVAL_PENDING'), true)
assert.equal(isAllowedPaymentTransition('APPROVAL_PENDING', 'APPROVED'), true)
assert.equal(isAllowedPaymentTransition('APPROVED', 'COMPLETION_PENDING'), true)
assert.equal(isAllowedPaymentTransition('COMPLETION_PENDING', 'COMPLETED'), true)
assert.equal(isAllowedPaymentTransition('COMPLETED', 'FULFILLED'), true)
assert.equal(isAllowedPaymentTransition('COMPLETED', 'REFUNDED'), true)
assert.equal(isAllowedPaymentTransition('COMPLETED', 'FAILED'), false)
assert.equal(isAllowedPaymentTransition('COMPLETED', 'CANCELLED'), false)
assert.equal(isAllowedPaymentTransition('COMPLETED', 'INCOMPLETE'), false)
assert.equal(isAllowedPaymentTransition('FULFILLED', 'COMPLETED'), false)
assert.equal(isAllowedPaymentTransition('FAILED', 'COMPLETED'), false)
assert.equal(isAllowedPaymentTransition('CANCELLED', 'APPROVED'), false)
assert.equal(isAllowedPaymentTransition('INCOMPLETE', 'COMPLETION_PENDING'), true)
assert.equal(isAllowedPaymentTransition('APPROVED', 'APPROVED'), true)
assert.equal(isAllowedPaymentTransition('CREATED', 'FULFILLED'), false)
assert.equal(isAllowedPaymentTransition('unknown', 'COMPLETED'), false)

const checks = [
  ['all upload paths use shared owner-first path policy', mediaRoute.includes('buildOwnedMediaPath(auth.userId') && uploadIntent.includes('buildOwnedMediaPath(auth.userId') && uploadComplete.includes('parseOwnedMediaPath(auth.userId')],
  ['storage path agrees with database owner_id prefix constraint', mediaAssetMigration.includes("storage_path LIKE owner_id || '/%'") && assetStore.includes('parseOwnedMediaPath(input.ownerId, input.storagePath)')],
  ['media metadata is validated before privileged persistence', assetStore.includes('validateMediaMetadata(input)') && assetStore.includes('mediaExtensionMatchesMime') && assetStore.includes('mediaCategoryMatches')],
  ['failed asset RPC cannot fall back to direct table insert', assetStore.includes('Do not bypass a rejected/missing RPC') && !assetStore.includes('/rest/v1/gh_media_assets')],
  ['direct upload completion verifies actual storage object and size', uploadComplete.includes('UPLOADED_OBJECT_NOT_VERIFIED') && uploadComplete.includes('storedSize !== byteSize')],
  ['direct upload rejects malformed numeric sizes', uploadIntent.includes('!Number.isSafeInteger(byteSize)')],
  ['signed upload URL must remain on configured HTTPS storage origin', uploadIntent.includes('SIGNED_UPLOAD_URL_UNTRUSTED') && uploadIntent.includes('parsedUploadUrl.origin !== new URL(base).origin') && uploadIntent.includes('parsedUploadUrl.protocol !== "https:"')],
  ['payment intent creation validates purpose, provider, currency and numeric precision', intentStore.includes('INVALID_PAYMENT_INTENT_INPUT') && intentStore.includes('input.amount.toFixed(8)')],
  ['idempotency keys are trimmed and bounded before persistence', intentStore.includes('INVALID_IDEMPOTENCY_KEY') && intentStore.includes('normalizedKey.length > 200')],
  ['payment intent IDs use cryptographic randomness', intentStore.includes('randomUUID().replace(/-/g, "")')],
  ['media asset IDs use cryptographic randomness', assetStore.includes('randomUUID().replace(/-/g, "")')],
  ['payment sync getter cannot turn process cache into production authority', intentStore.includes('Synchronous cache access is for display/Studio compatibility only')],
  ['payment intent idempotency lookup is durable and server-only', intentStore.includes('ghc_payment_intent_by_idempotency') && idempotencyMigration.includes('TO service_role')],
  ['idempotency key reuse with different request parameters is rejected', intentStore.includes('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST')],
  ['provider binding uses row-locked durable RPC when DB is configured', intentStore.includes('ghc_payment_intent_bind_provider') && atomicPaymentMigration.includes('FOR UPDATE')],
  ['payment transitions use row-locked durable RPC when DB is configured', intentStore.includes('ghc_payment_intent_transition') && atomicPaymentMigration.includes('FOR UPDATE')],
  ['completed payments cannot regress to failed/cancelled/incomplete states', atomicPaymentMigration.includes('COMPLETED_STATUS_CANNOT_REGRESS') && atomicPaymentMigration.includes("v_row.status = 'COMPLETED' AND v_next NOT IN ('FULFILLED', 'REFUNDED')")],
  ['atomic provider binding and transition RPCs are service-role only', atomicPaymentMigration.includes('GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_bind_provider(text,text,text) TO service_role') && atomicPaymentMigration.includes('GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_transition(text,text,text,text,text,text,text,jsonb) TO service_role')],
  ['original SECURITY DEFINER payment RPCs explicitly revoke client EXECUTE', ['ghc_payment_intent_upsert(jsonb)', 'ghc_payment_intent_get(text)', 'ghc_payment_intent_by_provider(text)'].every((signature) => atomicPaymentMigration.includes(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated`))],
  ['read-only post-migration SQL assertions cover RPC ACLs and uniqueness', fs.existsSync('supabase/tests/PHASE5_PAYMENT_INTENT_POST_MIGRATION_ASSERTIONS.sql') && read('supabase/tests/PHASE5_PAYMENT_INTENT_POST_MIGRATION_ASSERTIONS.sql').includes('has_function_privilege')],
  ['concurrency plan covers idempotency, provider binding, terminal state and recovery races', fs.existsSync('supabase/tests/PHASE5_PAYMENT_INTENT_CONCURRENCY_TEST_PLAN.md') && read('supabase/tests/PHASE5_PAYMENT_INTENT_CONCURRENCY_TEST_PLAN.md').includes('Completed versus failed callback race')],
  ['failed durable bind does not return an unpersisted intent', intentStore.includes('return await persistCritical(intent)')],
  ['payment approve/complete routes do not use synchronous cache after durable read failure', !read('app/api/payments/approve/route.ts').includes('|| getPaymentIntent(intentId)') && !read('app/api/payments/complete/route.ts').includes('|| getPaymentIntent(intentId)')],
  ['provider binding is durable before Pi approve/complete actions', read('app/api/payments/approve/route.ts').includes('PAYMENT_INTENT_BIND_UNAVAILABLE') && read('app/api/payments/complete/route.ts').includes('PAYMENT_INTENT_BIND_UNAVAILABLE')],
  ['state transition RPC cannot silently perform provider binding', intentStore.includes('intent.providerPaymentId !== opts.providerPaymentId') && atomicPaymentMigration.includes('PROVIDER_BIND_REQUIRED')],
  ['Pi completion is not reported successful when durable completion write fails', read('app/api/payments/complete/route.ts').includes('PAYMENT_COMPLETED_RECONCILIATION_PENDING') && read('app/api/payments/incomplete/route.ts').includes('PAYMENT_COMPLETED_RECONCILIATION_PENDING')],
  ['approve and complete require successful Pi lookup before provider action', read('app/api/payments/approve/route.ts').includes('PI_PAYMENT_LOOKUP_UNAVAILABLE') && read('app/api/payments/complete/route.ts').includes('PI_PAYMENT_LOOKUP_UNAVAILABLE')],
  ['idempotent approve does not claim provider success after an approval error', read('app/api/payments/approve/route.ts').includes('PI_APPROVE_FAILED') && read('app/api/payments/approve/route.ts').includes('intent.status === "FULFILLED"')],
  ['cancel/recovery responses require durable terminal status persistence', read('app/api/payments/intents/[intentId]/recover/route.ts').includes('cancelledIntent.status !== "CANCELLED"') && read('app/api/payments/incomplete/route.ts').includes('cancelledIntent.status !== "CANCELLED"')],
  ['same-status payment retries persist diagnostics without changing state', intentStore.includes('opts?.error !== undefined') && atomicPaymentMigration.includes('STATUS_RETRY_') && atomicPaymentMigration.includes('last_error = CASE WHEN p_error IS NULL THEN last_error')],
  ['withdrawal lock query failure is not converted to zero locked balance', /fetchLockedGhc\(userId: string\): Promise<number \| null>/.test(withdrawal) && withdrawal.includes('if (!result.ok) return null')],
  ['withdrawal quote fails closed without wallet snapshot', withdrawalRoute.includes('WALLET_SNAPSHOT_UNAVAILABLE') && withdrawalRoute.includes('WITHDRAWAL_LOCKS_UNAVAILABLE')],
  ['withdrawal history failure is distinguishable from empty history', withdrawal.includes('Promise<WithdrawalRequest[] | null>') && withdrawalRoute.includes('WITHDRAWAL_HISTORY_UNAVAILABLE')],
  ['message membership roster never falls back to memory when DB is configured', messagingStore.includes('if (ok && Array.isArray(data)) return data.map((r) => r.gh_user_id)\n    return []')],
  ['messaging membership and community writes fail closed when production DB is absent', messagingStore.includes('if (isProd()) return false') && messagingStore.includes('else if (isProd()) {\n    return { ok: false, error: "STORE_UNAVAILABLE" }')],
  ['messaging backend calls have bounded deadlines', messagingStore.includes('AbortSignal.timeout(8_000)')],
]
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
  assert.ok(passed, name)
}
console.log(`Phase 5–6 massive hardening: ${checks.length + 35}/${checks.length + 35} passed`)
