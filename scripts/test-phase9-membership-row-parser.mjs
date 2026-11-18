#!/usr/bin/env node
import assert from 'node:assert/strict'
import { parseMembershipEntitlementRow } from '../lib/server/membership/entitlement-row.ts'

const now = Date.parse('2026-11-06T12:00:00.000Z')
const future = new Date(now + 30 * 86_400_000).toISOString()
const base = {
  user_id: 'user-1', tier: 'vip', active: true,
  started_at: new Date(now - 1_000).toISOString(), expires_at: future,
  billing_period: 'monthly', source: 'ghc', updated_at: new Date(now).toISOString(),
  purchase_ref: 'membership-ref-1', audit: [{ at: now - 1, action: 'GRANT' }],
}

const valid = parseMembershipEntitlementRow(base, 'user-1', now)
assert.equal(valid.tier, 'vip')
assert.equal(valid.userId, 'user-1')
assert.equal(valid.expiresAt, Date.parse(future))

assert.throws(() => parseMembershipEntitlementRow({ ...base, user_id: 'user-2' }, 'user-1', now), /IDENTITY/)
assert.throws(() => parseMembershipEntitlementRow({ ...base, tier: 'admin' }, 'user-1', now), /TIER/)
assert.throws(() => parseMembershipEntitlementRow({ ...base, active: 'true' }, 'user-1', now), /ACTIVE/)
assert.throws(() => parseMembershipEntitlementRow({ ...base, source: 'client' }, 'user-1', now), /SOURCE/)
assert.throws(() => parseMembershipEntitlementRow({ ...base, billing_period: 'weekly' }, 'user-1', now), /PERIOD/)
assert.throws(() => parseMembershipEntitlementRow({ ...base, expires_at: 'not-a-date' }, 'user-1', now), /EXPIRY_INVALID/)
assert.throws(() => parseMembershipEntitlementRow({ ...base, expires_at: null }, 'user-1', now), /EXPIRY_MISSING/)
assert.throws(() => parseMembershipEntitlementRow({ ...base, expires_at: new Date(now - 2_000).toISOString() }, 'user-1', now), /EXPIRY_RANGE/)
assert.throws(() => parseMembershipEntitlementRow({ ...base, updated_at: null }, 'user-1', now), /UPDATED_AT/)

const comp = parseMembershipEntitlementRow({ ...base, source: 'comp', billing_period: 'comp', expires_at: null }, 'user-1', now)
assert.equal(comp.tier, 'vip')
assert.equal(comp.expiresAt, undefined)

const expired = parseMembershipEntitlementRow({ ...base, expires_at: new Date(now - 1).toISOString() }, 'user-1', now)
assert.equal(expired.tier, 'free')
assert.equal(expired.source, 'default')
assert.equal(expired.active, true)
assert.ok(expired.audit.some((entry) => entry.action === 'EXPIRED_OR_INACTIVE'))

const inactive = parseMembershipEntitlementRow({ ...base, active: false }, 'user-1', now)
assert.equal(inactive.tier, 'free')
assert.equal(inactive.source, 'default')

console.log('Phase 9 membership row parser: 14/14 assertions passed.')
