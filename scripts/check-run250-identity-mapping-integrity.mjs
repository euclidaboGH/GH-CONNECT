#!/usr/bin/env node
/** Run #250: protect verified Pi identity mappings from lookup outages and upsert races. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const source = readFileSync(join(root, 'lib/server/identity/pi-identity-store.ts'), 'utf8')
const migration = readFileSync(join(root, 'supabase/migrations/20261022010019_gh_pi_identities.sql'), 'utf8')
const checks = [
  ['database lookup errors are surfaced, not converted to missing identity', /if \(!res\.ok\)[\s\S]{0,180}throw new Error\("PI_IDENTITY_LOOKUP_FAILED"\)/.test(source)],
  ['identity updates use PATCH by immutable Pi UID', /function dbUpdateExisting[\s\S]*?pi_app_uid=eq\.[\s\S]*?method: "PATCH"/.test(source)],
  ['identity update does not write gh_user_id', (() => { const body = source.match(/async function dbUpdateExisting[\s\S]*?body: JSON\.stringify\(\{([\s\S]*?)\}\)/)?.[1] || ''; return !/gh_user_id/.test(body) })()],
  ['new identity insert ignores unique conflicts instead of merging', /function dbInsertNew[\s\S]*?resolution=ignore-duplicates,return=representation/.test(source)],
  ['legacy merge-duplicates upsert is removed', !/resolution=merge-duplicates/.test(source)],
  ['concurrent insert conflict re-reads the winning identity', /concurrentWinner = await dbSelectByPi\(rec\.piAppUid\)/.test(source)],
  ['lookup failure is not treated as a new identity in durable flow', /Durable path: a lookup error is not equivalent to an absent identity[\s\S]*?const existing = await dbSelectByPi\(piAppUid\)/.test(source)],
  ['production identity lookup does not fall back to stale process memory', /catch \(error\) \{\s*if \(isProductionRuntime\(\)\) throw error\s*return memoryGetByPi\(key\)/.test(source)],
  ['canonical GH user ID uniqueness is declared in original schema migration', /CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_pi_identities_gh_user_id[\s\S]*?ON public\.gh_pi_identities \(gh_user_id\)/.test(migration)],
  ['production username lookup fails closed rather than using stale process cache', (() => { const block = source.match(/export async function getByPiUsername[\s\S]*?(?=export async function getByGhUserId)/)?.[0] || ''; return /if \(isProductionRuntime\(\)\) return null/.test(block) && /if \(!res\.ok\)[\s\S]*?throw new Error/.test(block) && /Non-production only/.test(block) })()],
]
let failed = 0
for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  if (!pass) failed++
}
console.log(`\nRun #250 identity integrity: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exitCode = 1
