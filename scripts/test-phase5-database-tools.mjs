#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('..', import.meta.url)))
const files = {
  reset: join(root, 'supabase', 'RESET-GREENHAVEN-DATABASE.sql'),
  install: join(root, 'supabase', 'GREENHAVEN-CANONICAL-SUPABASE-INSTALL.sql'),
  validate: join(root, 'supabase', 'VALIDATE-GREENHAVEN-DATABASE.sql'),
  ops: join(root, 'supabase', 'PHASE5-DATABASE-OPERATIONS.md'),
  generator: join(root, 'scripts', 'generate-canonical-database.mjs'),
}
for (const [name, file] of Object.entries(files)) {
  assert.ok(statSync(file).size > 0, `${name} artifact is empty`)
}

const reset = readFileSync(files.reset, 'utf8')
const install = readFileSync(files.install, 'utf8')
const validate = readFileSync(files.validate, 'utf8')

assert.match(reset, /BEGIN;/)
assert.match(reset, /COMMIT;/)
assert.match(reset, /c\.relname ~ '\^\(gh\|ghc\|ghpv\)'/)
assert.match(reset, /deptype = 'e'/)
assert.doesNotMatch(reset, /DROP SCHEMA\s+IF EXISTS\s+public\s+CASCADE/i)
assert.doesNotMatch(reset, /DROP SCHEMA\s+public\s+CASCADE/i)
assert.match(reset, /Storage/i)
assert.match(install, /-- GENERATED FILE — DO NOT EDIT BY HAND/)
assert.match(install, /-- Regenerate with: npm run db:generate-canonical/)
assert.match(install, /20261022010001_ghc_economy_ledger\.sql/)
assert.match(install, /20261022010115_paystack_ngn_beneficiaries_and_payouts\.sql/)
assert.match(readFileSync(files.generator, 'utf8'), /db:generate-canonical|Canonical installer generated/)
assert.match(validate, /GREENHAVEN DATABASE VALIDATION: PASS/)
assert.match(validate, /greenhaven_tables/)
assert.match(validate, /greenhaven_functions/)

const migrationDir = join(root, 'supabase', 'migrations')
const { readdirSync } = await import('node:fs')
const migrations = readdirSync(migrationDir).filter(n => /^\d{14}_.+\.sql$/.test(n))
const sourceMarkers = (install.match(/^-- SOURCE \d{3}: \d{14}_.+\.sql$/gm) ?? []).length
assert.equal(sourceMarkers, migrations.length, `canonical installer has ${sourceMarkers} sources but ${migrations.length} migrations exist`)
assert.equal(migrations.length, 115, `current baseline expected 115 clean migrations, found ${migrations.length}`)
assert.match(readFileSync(files.ops, 'utf8'), /npm run db:generate-canonical/)
assert.match(readFileSync(files.ops, 'utf8'), /object-based, not migration-count-based/)

console.log(`Phase 5 database tools: PASS (reset/install/validate/generator present; canonical installer covers all ${migrations.length} clean migrations).`)
