#!/usr/bin/env node
import assert from 'node:assert/strict'
import {
  parseMembershipProductId,
  membershipAccessMonths,
  durationForBillingPeriod,
  membershipRenewalStartAt,
  MEMBERSHIP_RENEWAL_CONTINUITY_GRACE_MS,
} from '../lib/server/membership/renewal-policy.ts'

assert.deepEqual(parseMembershipProductId('membership_vip_monthly'), { tier: 'vip', billingPeriod: 'monthly' })
assert.deepEqual(parseMembershipProductId('membership_vvip_yearly'), { tier: 'vvip', billingPeriod: 'yearly' })
assert.equal(parseMembershipProductId('membership_vvip_lifetime'), null)
assert.equal(parseMembershipProductId('../membership_vip_monthly'), null)
assert.equal(membershipAccessMonths('monthly'), 2)
assert.equal(membershipAccessMonths('four_months'), 5)
assert.equal(membershipAccessMonths('eight_months'), 9)
assert.equal(membershipAccessMonths('yearly'), 13)
assert.equal(durationForBillingPeriod('yearly'), '13 months')

const now = Date.UTC(2026, 10, 6, 12, 0, 0)
const expiry = now - 36 * 60 * 60 * 1000
assert.equal(membershipRenewalStartAt({ tier: 'vip', active: true, expiresAt: expiry, now }), expiry)
assert.equal(membershipRenewalStartAt({ tier: 'vip', active: true, expiresAt: now + 5_000, now }), now + 5_000)
assert.equal(membershipRenewalStartAt({ tier: 'vip', active: true, expiresAt: now - 73 * 60 * 60 * 1000, now }), now)
assert.equal(membershipRenewalStartAt({ tier: 'free', active: true, expiresAt: expiry, now }), now)
assert.equal(membershipRenewalStartAt({ tier: 'vip', active: false, expiresAt: expiry, now }), now)
assert.equal(MEMBERSHIP_RENEWAL_CONTINUITY_GRACE_MS, 72 * 60 * 60 * 1000)
console.log('Phase 9 membership renewal policy: 15/15 assertions passed.')
