#!/usr/bin/env node
/** Guard against presenting unknown or inconsistent wallet values as reconciled. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = readFileSync('lib/domains/adapters/wallet-read-seam.ts', 'utf8')
const ready = source.slice(source.indexOf('const locked = numOrNull(w?.locked)'), source.indexOf('} catch (e) {'))
const checks = [
  ['wallet adapter exposes ledgerBalance as an optional source field', /ledgerBalance\?: number/.test(source)],
  ['ledger balance is read only from an actual finite source value', /const ledger = numOrNull\(w\?\.ledgerBalance\)/.test(ready)],
  ['missing ledger does not get replaced by available plus locked', /ledgerBalance: ledger/.test(ready) && !/ledgerBalance: Number\.isFinite\(ledger\) \? ledger : available \+ locked/.test(ready)],
  ['reconciliation equality requires a known locked amount and ledger', /locked !== null &&[\s\S]*?ledger !== null &&[\s\S]*?Math\.abs\(\(available \+ locked\) - ledger\)/.test(ready)],
  ['missing pending data is not silently converted to zero', /const pending = numOrNull\(w\?\.pending\) \?\? numOrNull\(w\?\.pendingBalance\)/.test(source)],
  ['nonnegative checks are computed from observed values', /availableNonNegative: available >= 0/.test(ready) && /pendingNonNegative: pending !== null && pending >= 0/.test(ready) && /ledgerNonNegative: ledger !== null && ledger >= 0/.test(ready)],
  ['unavailable and error snapshots do not claim reconciliation success', (source.match(/availablePlusLockedEqualsLedger:false, availableNonNegative:false, pendingNonNegative:false, ledgerNonNegative:false/g) || []).length === 3],
  ['wallet read seam remains presentation-only and mutation-free', /WALLET_READ_SEAM_MUTATIONS/.test(source) && /transfer: false/.test(source) && /spend: false/.test(source) && /claim: false/.test(source)],
]
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); assert.ok(ok, label) }
console.log(`PASS ${checks.length}/${checks.length} wallet reconciliation truthfulness checks`)
