#!/usr/bin/env node
import assert from 'node:assert/strict'
import { formatPiAtomic, normalizeCharityImpactSummary } from '../lib/ecosystem/charity-impact.ts'

const raw = {
  ok: true,
  totalAtomic: '12345678',
  contributionCount: 3,
  items: [
    { id: '00000000-0000-4000-8000-000000000001', amount_atomic: '2500000', campaign_key: 'school_meals', reason: 'Recorded support', status: 'recorded', created_at: '2026-11-10T10:00:00.000Z', unique_ref: 'must-not-leak' },
    { id: '00000000-0000-4000-8000-000000000002', amount_atomic: '1000000', campaign_key: 'general', reason: 'Pending item', status: 'pending', created_at: '2026-11-10T09:00:00.000Z' },
    { id: '00000000-0000-4000-8000-000000000003', amount_atomic: '500000', campaign_key: 'water', reason: 'Recorded', status: 'recorded', created_at: '2026-11-09T10:00:00.000Z' },
    { id: 'bad-id', amount_atomic: '100', campaign_key: 'bad', reason: 'Bad ID', status: 'recorded', created_at: '2026-11-09T10:00:00.000Z' },
    { id: '00000000-0000-4000-8000-000000000005', amount_atomic: '-10', campaign_key: 'bad', reason: 'Negative', status: 'recorded', created_at: '2026-11-09T10:00:00.000Z' },
  ],
}
const summary = normalizeCharityImpactSummary(raw)
assert.ok(summary)
assert.equal(summary.totalAtomic, '12345678')
assert.equal(summary.contributionCount, 3)
assert.equal(summary.items.length, 2)
assert.equal(summary.items[0].campaignKey, 'school_meals')
assert.equal('uniqueRef' in summary.items[0], false)
assert.equal(summary.withdrawable, false)
assert.equal(summary.segregated, true)
assert.equal(normalizeCharityImpactSummary({ ok: false, totalAtomic: '1' }), null)
assert.equal(normalizeCharityImpactSummary({ ok: true, totalAtomic: '-1' }), null)
assert.equal(normalizeCharityImpactSummary({ ok: true, totalAtomic: '1e7' }), null)
assert.equal(normalizeCharityImpactSummary({ ok: true, totalAtomic: 9007199254740992, contributionCount: 0, items: [] }), null)
assert.equal(normalizeCharityImpactSummary({ ok: true, totalAtomic: '100', items: [] }), null)
assert.equal(normalizeCharityImpactSummary({ ok: true, totalAtomic: '100', contributionCount: -1, items: [] }), null)
assert.equal(formatPiAtomic('10000000'), '1.0000000')
assert.equal(formatPiAtomic('12345678'), '1.2345678')
assert.equal(formatPiAtomic('9'), '0.0000009')
assert.equal(formatPiAtomic('-1'), '0.0000000')
assert.equal(formatPiAtomic(9007199254740992), '0.0000000')
console.log('Charity impact contract: 19/19 passed')
