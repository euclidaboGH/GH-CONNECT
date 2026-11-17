#!/usr/bin/env node
import fs from 'node:fs'
const failures = []
const store = fs.readFileSync('lib/server/marketplace/order-store.ts', 'utf8')
const migrationPath = 'supabase/migrations/20261101160002_marketplace_atomic_order_transitions.sql'
const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : ''
if (!migration) failures.push('atomic marketplace transition migration missing')
if (!/rpcJson\("gh_marketplace_order_transition"/.test(store)) failures.push('durable transition path does not call the atomic RPC')
if (!/DURABLE_TRANSITION_RPC_UNAVAILABLE/.test(store)) failures.push('durable RPC outage must fail closed')
const durableBranch = store.split('if (dbConfigured()) {', 2)[1]?.split('\n  let order = map()', 1)[0] || ''
if (!durableBranch || /saveOrder\s*\(/.test(durableBranch)) failures.push('durable transition path must not use read/modify/upsert')
if (!/FOR UPDATE/.test(migration)) failures.push('atomic RPC must lock the order row')
if (!/gh_marketplace_order_transition\(text,text,text,text\)/.test(migration)) failures.push('atomic transition function signature missing from ACL')
if (!/REVOKE ALL ON FUNCTION public\.gh_marketplace_order_transition\(text,text,text,text\) FROM PUBLIC/.test(migration)) failures.push('atomic RPC public execute privilege not revoked')
if (!/GRANT EXECUTE ON FUNCTION public\.gh_marketplace_order_transition\(text,text,text,text\) TO service_role/.test(migration)) failures.push('atomic RPC must be service_role only')
if (!/gh_marketplace_order_get\(r\.id\)/.test(migration)) failures.push('atomic transition must return refreshed canonical order data')
if (!/WHERE id=r\.id/.test(migration)) failures.push('commerce RPC must refresh using the locked canonical order ID')
const phase23Migration = fs.readFileSync('supabase/migrations/20261104170001_marketplace_order_read_cleanup_separation.sql', 'utf8')
if (/PERFORM public\.gh_marketplace_release_expired_reservations\(\)/.test(phase23Migration)) failures.push('order snapshot must not sweep unrelated reservations while a transition row is locked')
if (!/gh_marketplace_release_expired_reservations/.test(store)) failures.push('application order reads must explicitly expire stale reservations before fetching snapshots')
if (!/payment_verified/.test(migration) || !/payment_status/.test(migration)) failures.push('payment state contract missing')
if (!/r\.payment_claimed_at IS NOT NULL/.test(migration)) failures.push('active payment claim must fence cancellation')
if (!/PAYMENT_IN_PROGRESS/.test(migration)) failures.push('active payment claim conflict response missing')
if (!/gh_marketplace_order_commerce_update[\s\S]*?payment_claimed_at IS NOT NULL/.test(migration)) failures.push('commerce cancellation path must enforce payment-claim fence')
if (!/PAYMENT_NOT_VERIFIED/.test(migration)) failures.push('payment_verified transition must require persisted verified payment status')
if (/UPDATE\s+public\.gh_marketplace_orders[\s\S]{0,500}(ghc|wallet|ledger|balance)/i.test(migration)) failures.push('transition RPC must not mutate wallet/ledger balances')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
for (const name of ['prebuild:checks', 'verify:static']) if (!pkg.scripts?.[name]?.includes('check-phase22-marketplace-atomic-transitions.mjs')) failures.push(`${name} pipeline missing Phase 22 gate`)
for (const name of ['prebuild:checks', 'verify:static']) if (!pkg.scripts?.[name]?.includes('check-phase23-migration-integrity.mjs')) failures.push(`${name} pipeline missing Phase 23 migration integrity gate`)
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'))
if (pkg.version !== lock.version || pkg.version !== lock.packages?.['']?.version) failures.push('package/lockfile version mismatch')
const migrations = fs.readdirSync('supabase/migrations').filter(n => /^\d+.*\.sql$/.test(n))
const prefixes = migrations.map(n => n.match(/^\d+/)?.[0])
if (new Set(prefixes).size !== prefixes.length) failures.push('duplicate migration numeric prefixes')
const manifest = fs.readFileSync('VERIFIED_MANIFEST.txt', 'utf8')
const manifestCount = Number((manifest.match(/^canonical_migrations=(\d+)$/m) || [])[1])
if (migrations.length !== manifestCount || !manifest.includes('inventory_status=OK')) failures.push(`source migration inventory does not match verified manifest: ${migrations.length} vs ${manifestCount}`)
if (failures.length) { console.error(`Phase 22 marketplace atomic-transition gate: FAIL (${failures.length})`); for (const f of failures) console.error(` - ${f}`); process.exit(1) }
console.log('Phase 22 marketplace atomic-transition gate: PASS (row-locking RPC, service-role ACL, fail-closed transport, no financial mutation, manifest-synchronized unique migrations)')
