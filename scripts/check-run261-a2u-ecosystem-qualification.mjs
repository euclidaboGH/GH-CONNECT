import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(p, 'utf8')
const route = read('app/api/admin/a2u-qualification/route.ts')
const page = read('app/admin/a2u-qualification/page.tsx')
const migration = read('supabase/migrations/20261110210001_pi_a2u_ecosystem_qualification.sql')
const docs = read('docs/PI_A2U_ECOSYSTEM_QUALIFICATION.md')
const owners = read('lib/architecture/domain-mutation-route-owners.json')
const checks = [
  ['operator API requires authenticated session and A2U admin key', /resolveAuthenticatedUser/.test(route) && /operatorKeyAuthorized/.test(route)],
  ['admin mutation route has an accountable payments-domain owner', /\/api\/admin\/a2u-qualification/.test(owners) && /payments/.test(owners)],
  ['KYC is explicit fully-passed operator attestation, not guessed from Pi login', /kycFullyPassed !== true/.test(route) && /fully_passed/.test(migration) && /does not independently query Pi KYC status/.test(route)],
  ['recipient UID is verified against GreenHaven Pi identity mapping', /gh_pi_a2u_qualification_attest_recipient/.test(route) && /PI_IDENTITY_MAPPING_MISMATCH/.test(migration) && /gh_pi_a2u_qualification_recipient_get/.test(migration)],
  ['all qualification reads and writes are fenced to the Testnet environment', /testnetQualificationEnabled/.test(route) && /process.env.PI_NETWORK === "testnet"/.test(route) && /PI_A2U_TESTNET_ONLY/.test(route) && /Pi Testnet/.test(migration)],
  ['provider payment is read-only verified for A2U direction, network, UID, amount, txid and completion', /sdk\.getPayment\(paymentId\)/.test(route) && /payment\.direction === "app_to_user"/.test(route) && /payment\.status\?\.developer_completed === true/.test(route) && /transaction_verified/.test(route)],
  ['provider destination must match the recipient authorised Pi wallet address', /payment\.to_address/.test(route) && /getWalletAuthorization/.test(route) && /PROVIDER_DESTINATION_DOES_NOT_MATCH_VERIFIED_PI_WALLET/.test(route) && /recipient_wallet_address/.test(migration)],
  ['provider record must include GreenHaven A2U metadata and request reference', /metadata\?\.direction/.test(route) && /metadata\?\.payoutRequestId/.test(route)],
  ['five qualifying transactions require distinct KYC-attested recipients', /pi_app_uid text NOT NULL UNIQUE REFERENCES/.test(migration) && /requiredCount',5/.test(migration)],
  ['provider payment ID and blockchain txid cannot be counted twice', /provider_payment_id text NOT NULL UNIQUE/.test(migration) && /txid text NOT NULL UNIQUE/.test(migration)],
  ['qualification tables are private with client access revoked', /ENABLE ROW LEVEL SECURITY/.test(migration) && /REVOKE ALL ON TABLE/.test(migration)],
  ['qualification RPCs are service-role-only', /REVOKE ALL ON FUNCTION/.test(migration) && /GRANT EXECUTE ON FUNCTION/.test(migration) && !/TO authenticated/.test(migration)],
  ['operator UI explains no payment is created or completed by the register', /does not create, submit, complete, retry, or cancel/.test(page)],
  ['operator UI requires KYC confirmation and displays progress', /KYC passed \/ fully approved/.test(page) && /qualifiedCount/.test(page)],
  ['Mainnet approval remains separate and disabled', /Mainnet A2U remains disabled/.test(page) && /outgoing-wallet approval/.test(docs)],
  ['documentation states five transaction target is evidence, not listing guarantee', /five successfully completed/.test(docs) && /not a guarantee/.test(docs)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nRun #261 A2U ecosystem qualification: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0)
