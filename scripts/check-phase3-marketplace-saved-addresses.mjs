#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }
const SQL = 'supabase/proposals/20261116_marketplace_phase3_saved_addresses_proposal.sql'
const sql = read(SQL)
const helper = read('lib/marketplace/saved-addresses.ts')
const route = read('app/api/marketplace/addresses/route.ts')
const pkg = JSON.parse(read('package.json'))

test('Saved-address helper and unit tests exist', existsSync(join(root, 'lib/marketplace/saved-addresses.ts')) && existsSync(join(root, 'scripts/test-phase3-marketplace-saved-addresses.mjs')))
test('Helper is pure (no network, database or storage access)', !/fetch\(|supabase|\.rpc\(|localStorage|sessionStorage|document\.|window\./.test(helper))
test('Helper reuses Phase 2 address validation', /from "\.\/address-validation\.ts"/.test(helper) && /validateAddress\(/.test(helper))
test('SQL is a held proposal, not a migration', /PROPOSAL ONLY/.test(sql) && /DO NOT APPLY/.test(sql))
test('No Phase 3 address migration was added to supabase/migrations', !readdirSync(join(root, 'supabase/migrations')).some((f) => /saved_address/i.test(f)))
test('Manifest does not list the proposal as an applied migration', !/saved_addresses/i.test(read('MIGRATION-SOURCE-MANIFEST.csv')))
test('Table has RLS enabled with a deny-all client policy and revoked grants', /ENABLE ROW LEVEL SECURITY/.test(sql) && /USING \(false\) WITH CHECK \(false\)/.test(sql) && /REVOKE ALL ON TABLE public\.gh_marketplace_saved_addresses FROM PUBLIC, anon, authenticated/.test(sql))
test('Every function is SECURITY DEFINER with a pinned search_path', (sql.match(/CREATE OR REPLACE FUNCTION/g) || []).length === 5 && (sql.match(/SECURITY DEFINER/g) || []).length === 5 && (sql.match(/SET search_path = pg_catalog, public, pg_temp/g) || []).length === 5)
test('Every function is service-role only', (sql.match(/GRANT EXECUTE ON FUNCTION[^;]*TO service_role;/g) || []).length === 5 && !/GRANT EXECUTE[^;]*(anon|authenticated|PUBLIC)\s*;/.test(sql) && (sql.match(/REVOKE ALL ON FUNCTION/g) || []).length === 5)
test('One default per user is enforced by a partial unique index', /uq_gh_marketplace_saved_addresses_one_default[\s\S]*WHERE is_default;/.test(sql))
test('Per-user cap and writes are serialised', /v_count >= 10/.test(sql) && /pg_advisory_xact_lock/.test(sql) && MAX_OK())
function MAX_OK() { return /MAX_SAVED_ADDRESSES = 10/.test(helper) }
test('Delete is a hard delete (no retained personal data) and keeps a default when addresses remain', /DELETE FROM public\.gh_marketplace_saved_addresses\s+WHERE id = p_address_id/.test(sql) && !/deleted_at/.test(sql) && /promote the most recently updated/.test(sql))
test('Erase-user RPC exists, is locked per user and service-role only', /FUNCTION public\.gh_marketplace_address_erase_user\(p_user_id text\)/.test(sql) && /DELETE FROM public\.gh_marketplace_saved_addresses WHERE user_id = v_user/.test(sql) && /GRANT EXECUTE ON FUNCTION public\.gh_marketplace_address_erase_user\(text\) TO service_role/.test(sql))
test('Route reads fields strictly (no String() coercion of request values)', /readAddressFields\(body\)/.test(route) && !/String\(body\./.test(route) && /export function readAddressFields/.test(helper))
test('Route never reflects raw RPC error text', /addressErrorResponse\(/.test(route) && !/String\(result\.data\?\.error/.test(route))
test('RLS and SECURITY DEFINER gates scan held proposals', /supabase', 'proposals'/.test(read('scripts/check-database-rls-coverage.mjs')) && /supabase', 'proposals'/.test(read('scripts/check-security-definer-acl.mjs')))
test('SQL touches no order, ledger, payment or payout object', !/gh_marketplace_orders|ledger|payout|gh_earnings|payment_intent/i.test(sql.replace(/--.*$/gm, '')))
test('Route requires authentication and rate-limits every method fail-closed', /resolveAuthenticatedUser/.test(route) && (route.match(/enforceUserMutationRateLimit\(/g) || []).length === 3 && (route.match(/failClosed: true/g) || []).length === 3)
test('Route exports only GET, POST and DELETE', ['GET', 'POST', 'DELETE'].every((m) => new RegExp(`export async function ${m}\\(`).test(route)) && !/export async function (PUT|PATCH)\(/.test(route))
test('Route fails closed with 503 when the server table is unavailable and never falls back to client storage', /MARKETPLACE_ADDRESSES_UNAVAILABLE/.test(route) && /status: 503/.test(route) && !/localStorage|sessionStorage|document\./.test(route))
test('Route bounds request size and validates with the shared helper', /readBoundedJson\(request, 8 \* 1024\)/.test(route) && /buildSavePayload\(/.test(route) && /isAddressId\(/.test(route))
test('Route responses are no-store and the route does not log personal data', /Cache-Control": "no-store"/.test(route) && !/console\./.test(route))
test('Route takes the user id only from the authenticated session', !/body\.(userId|user_id)/.test(route) && /p_user_id: auth\.userId/.test(route))
const panel = read('components/ghc/marketplace-addresses.tsx')
test('Addresses panel is mounted once in the Orders section and is collapsed by default', (read('components/ghc/marketplace-screen.tsx').match(/<MarketplaceAddressesPanel \/>/g) || []).length === 1 && /useState\(false\)/.test(panel) && /if \(next && load === "idle"\) void refresh\(\)/.test(panel))
test('Addresses panel uses only the addresses API, validates with the shared helper and never stores addresses in the browser', /\/api\/marketplace\/addresses/.test(panel) && /buildSavePayload\(/.test(panel) && !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(panel) && !/marketplace\/orders|socialCreateMarketplaceOrder|socialPayMarketplaceOrder/.test(panel))
test('Addresses panel is honest when the server table is unavailable and masks phone numbers', /data-testid="addresses-unavailable"/.test(panel) && /maskPhone\(a\.phone\)/.test(panel) && /not yet attached to orders/.test(panel))
test('Checkout, payment, order and payout code untouched by Phase 3', !/saved-addresses|marketplace\/addresses/.test(read('app/api/marketplace/orders/route.ts')) && !/saved-addresses|selectedAddress|deliveryAddress/.test(read('components/ghc/marketplace-screen.tsx')))
test('npm script check:marketplace-phase3 is registered', /check-phase3-marketplace-saved-addresses/.test(pkg.scripts?.['check:marketplace-phase3'] || ''))
test('Phase 3 doc exists and states production remains NOT APPROVED', existsSync(join(root, 'docs/MARKETPLACE-TRANSFORMATION-PHASE3.md')) && /NOT APPROVED/.test(read('docs/MARKETPLACE-TRANSFORMATION-PHASE3.md')))
const failed = checks.filter((x) => !x).length
console.log(`\nPhase 3 marketplace saved addresses: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
