import fs from 'node:fs'
import assert from 'node:assert/strict'
const lifecycle = fs.readFileSync('app/api/account/lifecycle/route.ts','utf8')
const exportRoute = fs.readFileSync('app/api/account/export/route.ts','utf8')
const payoutRoute = fs.readFileSync('app/api/marketplace/payouts/route.ts','utf8')
const migration = fs.readFileSync('supabase/migrations/202610250003_gh_lifecycle_payout_quality_foundation.sql','utf8')
const mediaContent = fs.readFileSync('app/api/media/[id]/content/route.ts','utf8')
const checks = [
  ['lifecycle requires session-derived identity', lifecycle.includes('resolveAuthenticatedUser(request.headers)')],
  ['lifecycle requires recent step-up', lifecycle.includes('requireRecentStepUp(auth)')],
  ['lifecycle idempotency key validation', lifecycle.includes('IDEMPOTENCY_KEY_REQUIRED')],
  ['deletion endpoint explicitly does not delete immediately', lifecycle.includes('deletionExecuted: false')],
  ['export requires recent step-up', exportRoute.includes('requireRecentStepUp(auth)')],
  ['export uses fixed source allowlist', exportRoute.includes('const sources: ExportSource[]')],
  ['export has no-cache response policy', exportRoute.includes('private, no-store')],
  ['export fails closed on incomplete source', exportRoute.includes('EXPORT_INCOMPLETE')],
  ['export paginates instead of silently truncating at 5000 rows', exportRoute.includes('readCompleteExportSource') && exportRoute.includes('Range-Unit') && !exportRoute.includes('&limit=5000')],
  ['export fails closed above per-source row ceiling', exportRoute.includes('SOURCE_ROW_LIMIT_EXCEEDED')],
  ['lifecycle safely handles non-object JSON bodies', fs.readFileSync('app/api/account/lifecycle/route.ts','utf8').includes('!Array.isArray(parsedBody)')],
  ['private media facade delegates to authenticated signer', mediaContent.includes('/signed-url') && mediaContent.includes('signedResponse.ok')],
  ['private media facade restricts redirect to configured Supabase origin', mediaContent.includes('signed.origin !== trustedStorageOrigin') && mediaContent.includes('signed.protocol !== "https:"')],
  ['private media facade is non-cacheable and no-referrer', mediaContent.includes('private, no-store') && mediaContent.includes('\"Referrer-Policy\": \"no-referrer\"')],
  ['payout request requires recent step-up', payoutRoute.includes('requireRecentStepUp(auth)')],
  ['payout seller identity comes from session', payoutRoute.includes('p_seller_id: auth.userId')],
  ['payout request never claims funds paid', payoutRoute.includes('paid: false')],
  ['payout allocation table prevents double allocation', migration.includes('UNIQUE(order_id)')],
  ['payout eligibility requires completed and verified orders', migration.includes("o.status='completed' AND o.payment_status='verified'")],
  ['payout requires full eligible balance', migration.includes('AMOUNT_MUST_MATCH_ELIGIBLE_BALANCE')],
  ['payout state transitions require provider reference before paid', migration.includes('PAYOUT_REFERENCE_REQUIRED') && migration.includes("p_next_status='paid' AND v_request.status<>'processing'")],
  ['rejected payout releases order allocations for a safe retry', migration.includes("IF p_next_status IN ('rejected','failed','cancelled') THEN DELETE FROM public.gh_seller_payout_allocations")],
  ['lifecycle database functions service-role only', migration.includes('GRANT EXECUTE ON FUNCTION public.gh_account_lifecycle_request(text,text,text) TO service_role')],
  ['creator reward table cannot mint by itself', migration.includes('Never mints GHC by itself')],
  ['quality scores are bounded and not truth labels', migration.includes('quality_score<=100') && migration.includes('not truth labels')],
]
for (const [label, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`); assert.ok(pass, label) }
console.log(`Phase 15 source checks: ${checks.length}/${checks.length} passed`)
