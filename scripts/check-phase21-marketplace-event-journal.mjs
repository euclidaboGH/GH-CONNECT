#!/usr/bin/env node
/** Static source-contract checks for the Phase 21 marketplace lifecycle event journal. */
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(p, 'utf8')
const migration = read('supabase/migrations/20261030010010_phase21_marketplace_case_event_journal.sql')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['event journal references canonical marketplace orders with delete restriction', /order_id text NOT NULL REFERENCES public\.gh_marketplace_orders\(id\) ON DELETE RESTRICT/.test(migration)],
  ['journal captures payment, delivery, escrow, dispute and completion events', /PAYMENT_STATE_CHANGED/.test(migration) && /DELIVERY_STATE_CHANGED/.test(migration) && /ESCROW_STATE_CHANGED/.test(migration) && /DISPUTE_OPENED/.test(migration) && /ORDER_COMPLETED/.test(migration)],
  ['journal is populated by database triggers on insert and lifecycle updates', /AFTER INSERT ON public\.gh_marketplace_orders/.test(migration) && /AFTER UPDATE OF status,payment_status,escrow_status,delivery_status/.test(migration)],
  ['event payload is limited to lifecycle state and does not copy payment secrets', /before_state jsonb NOT NULL/.test(migration) && /after_state jsonb NOT NULL/.test(migration) && !/provider_payment_id|payment_secret|authorization_header/i.test(migration)],
  ['actor attribution distinguishes authenticated, service and unknown contexts', /authenticated_claim/.test(migration) && /service_context/.test(migration) && /unknown/.test(migration)],
  ['client access is denied by RLS', /ENABLE ROW LEVEL SECURITY/.test(migration) && /FOR ALL USING\(false\) WITH CHECK\(false\)/.test(migration)],
  ['event rows reject update and delete', /BEFORE UPDATE OR DELETE ON public\.gh_marketplace_order_events/.test(migration) && /MARKETPLACE_ORDER_EVENT_IMMUTABLE/.test(migration)],
  ['journal does not itself issue refunds or settle funds', /does not authorize refunds, move funds or resolve disputes/i.test(migration)],
  ['release version is synchronized', /^\d+\.\d+\.\d+$/.test(pkg.version) && read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
]
let failed = 0
for (const [name, pass] of checks) { console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) failed++ }
console.log(`\nPhase 21 marketplace event journal: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
