#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const migration = read('supabase/migrations/20261029010005_pi_identity_wallet_authorization.sql')
const store = read('lib/server/identity/wallet-authorization.ts')
const api = read('app/api/identity/wallet-authorization/route.ts')
const claim = read('app/api/economy/rewards/pi-cashback/claim/route.ts')
const a2u = read('app/api/payments/a2u/create/route.ts')
const me = read('app/api/identity/me/route.ts')
const checks = []
const test = (name, ok) => { checks.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`) }

test('Wallet authorization migration exists', existsSync(join(root, 'supabase/migrations/20261029010005_pi_identity_wallet_authorization.sql')))
test('Authorizations table has active/revoked/superseded statuses', /status IN \('active', 'revoked', 'superseded'\)/.test(migration))
test('Unique active authorization per user and per Pi uid', /uq_gh_pi_wallet_auth_active_user/.test(migration) && /uq_gh_pi_wallet_auth_active_uid/.test(migration))
test('Client RLS deny-all on authorization and event tables', /gh_pi_wallet_authorizations_no_client/.test(migration) && /gh_pi_identity_link_events_no_client/.test(migration))
test('Grant requires durable identity mapping match', /IDENTITY_MAPPING_REQUIRED/.test(migration) && /gh_pi_identities/.test(migration))
test('Assert payout requires active consent matching recipient uid', /WALLET_AUTHORIZATION_REQUIRED/.test(migration) && /gh_pi_wallet_authorization_assert_payout/.test(migration))
test('RPCs are service_role only', (migration.match(/GRANT EXECUTE ON FUNCTION public\.gh_pi_wallet_authorization_/g) || []).length >= 4)
test('Server store never trusts client recipient for grant', /getByGhUserId/.test(api) && /mapping\.piAppUid/.test(api) && !/body\.piAppUid/.test(api) && !/body\.recipient/.test(api))
test('API exposes GET grant POST revoke DELETE', /export async function GET/.test(api) && /export async function POST/.test(api) && /export async function DELETE/.test(api))
test('Cashback claim asserts wallet authorization before begin', /assertPayoutWalletAuthorization/.test(claim) && /WALLET_AUTHORIZATION_REQUIRED/.test(claim))
test('Seller A2U create asserts authorization for seller_id not caller alone', /assertPayoutWalletAuthorization\(\{ ghUserId: payout\.seller_id/.test(a2u))
test('Identity me reports walletAuthorization snapshot', /walletAuthorization/.test(me) && /getWalletAuthorization/.test(me))
test('Link events audit consent grant and revoke', /consent_granted/.test(migration) && /consent_revoked/.test(migration))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase 2 wallet authorization: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
