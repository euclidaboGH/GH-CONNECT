import assert from 'node:assert/strict'
import { buildCreatorTipIdempotencyKey } from '../lib/server/creator/tip-idempotency.ts'

const base = {
  tipperId: 'user-a',
  recipientId: 'creator-b',
  contentId: 'post-1',
  currency: 'PI',
  amount: 2,
}

const retryA = buildCreatorTipIdempotencyKey({ ...base, clientKey: 'tip-action-0001' })
const retryAAgain = buildCreatorTipIdempotencyKey({ ...base, clientKey: 'tip-action-0001' })
const laterTip = buildCreatorTipIdempotencyKey({ ...base, clientKey: 'tip-action-0002' })
const legacy = buildCreatorTipIdempotencyKey(base)
const legacyAgain = buildCreatorTipIdempotencyKey(base)

assert.equal(retryA.ok, true)
assert.equal(retryAAgain.ok, true)
assert.equal(retryA.key, retryAAgain.key, 'retry with same action key must recover same intent')
assert.notEqual(retryA.key, laterTip.key, 'new action key must allow a distinct later tip')
assert.equal(retryA.clientScoped, true)
assert.equal(legacy.ok, true)
assert.equal(legacy.key, legacyAgain.key, 'legacy fallback must remain deterministic')
assert.equal(buildCreatorTipIdempotencyKey({ ...base, clientKey: 'short' }).ok, false)
assert.equal(buildCreatorTipIdempotencyKey({ ...base, clientKey: 'invalid key with spaces' }).ok, false)
assert.equal(buildCreatorTipIdempotencyKey({ ...base, clientKey: 'x'.repeat(161) }).ok, false)

console.log('Phase 19 creator tip idempotency runtime: PASS (retry recovery, repeat tips, legacy fallback, invalid-key rejection)')
